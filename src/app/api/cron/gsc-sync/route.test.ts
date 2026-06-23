import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const {
  createAdminClient,
  getAccessToken,
  getSiteUrl,
  searchAnalyticsQuery,
  urlInspect,
  captureException,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getAccessToken: vi.fn(),
  getSiteUrl: vi.fn(),
  searchAnalyticsQuery: vi.fn(),
  urlInspect: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/seo/gsc/client", () => ({
  getAccessToken,
  getSiteUrl,
  searchAnalyticsQuery,
  urlInspect,
}))
vi.mock("@sentry/nextjs", () => ({ captureException }))

import { POST } from "./route"

// ---------------------------------------------------------------------------
// Supabase admin mock builder
// ---------------------------------------------------------------------------

/**
 * 라우트의 체인:
 *  - lock check:   from("gsc_sync_log").select().eq().eq().gte().limit()
 *  - lock insert:  from("gsc_sync_log").insert().select().single()
 *  - query upsert: from("gsc_query_metrics").upsert()
 *  - page upsert:  from("gsc_page_metrics").upsert()
 *  - products:     from("products").select().eq()
 *  - inspections:  from("gsc_url_inspections").select().order() + .upsert()
 *  - sync_log insert: from("gsc_sync_log").insert()
 *  - lock update:  from("gsc_sync_log").update().eq()
 */
interface MockOptions {
  lockInProgress?: boolean
  lockInsertId?: number
  queryRows?: unknown[]
  pageRows?: unknown[]
  products?: unknown[]
  existingInspections?: unknown[]
}

function makeAdminClient(opts: MockOptions = {}) {
  const {
    lockInProgress = false,
    lockInsertId = 1,
    products = [],
    existingInspections = [],
  } = opts

  // 각 테이블별로 다른 응답을 내보내야 하므로 from()에서 테이블명 분기.
  // 체인 메서드는 모두 자기 자신을 반환하다가 terminal 호출에서 Promise resolve.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeChain = (terminalValue: unknown): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(terminalValue)),
      insert: vi.fn(() => chain),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve(terminalValue)),
    }
    // eq 체인의 끝에서 Promise로 resolve 되는 경우 (select().eq() 등)
    // → 체인 자체도 thenable로 만들어 await 가능하게 함
    Object.assign(chain, {
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve(terminalValue).then(resolve),
    })
    return chain
  }

  // 체인을 재사용하지 않고 테이블마다 독립 체인 반환
  const upsertSpy = {
    gsc_query_metrics: vi.fn(() => Promise.resolve({ data: null, error: null })),
    gsc_page_metrics: vi.fn(() => Promise.resolve({ data: null, error: null })),
    gsc_url_inspections: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
  const insertSpy = vi.fn(() => Promise.resolve({ data: null, error: null }))

  // gsc_sync_log 전용 체인 (복잡: lock check + insert + update)
  let syncLogCallCount = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncLogChain = (): any => {
    const callNum = syncLogCallCount++
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch: any = {
      select: vi.fn(() => ch),
      eq: vi.fn(() => ch),
      gte: vi.fn(() => ch),
      limit: vi.fn(() => {
        // lock check 호출: 진행중 여부
        return Promise.resolve({
          data: lockInProgress ? [{ id: 99 }] : [],
          error: null,
        })
      }),
      insert: vi.fn(() => {
        // insert spy 기록
        insertSpy()
        // insert 후 체인: .select().single() → lock row 반환
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insertChain: any = {
          select: vi.fn(() => insertChain),
          single: vi.fn(() =>
            Promise.resolve({
              data: { id: lockInsertId },
              error: null,
            }),
          ),
          // insert만 하고 single 없이 await 되는 경우(sync_log finalize)
          then: (resolve: (v: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve),
        }
        return insertChain
      }),
      update: vi.fn(() => ch),
      then: (resolve: (v: unknown) => void) => {
        // select().eq()...로 await 되는 경우(lock check 체인 끝)
        const data =
          callNum === 0 && lockInProgress ? [{ id: 99 }] : []
        return Promise.resolve({ data, error: null }).then(resolve)
      },
    }
    return ch
  }

  // products 체인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsChain: any = {
    select: vi.fn(() => productsChain),
    eq: vi.fn(() =>
      Promise.resolve({ data: products, error: null }),
    ),
  }

  // gsc_url_inspections 체인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inspectionsChain: any = {
    select: vi.fn(() => inspectionsChain),
    order: vi.fn(() =>
      Promise.resolve({ data: existingInspections, error: null }),
    ),
    upsert: upsertSpy.gsc_url_inspections,
  }

  const fromFn = vi.fn((table: string) => {
    if (table === "gsc_sync_log") return syncLogChain()
    if (table === "gsc_query_metrics") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch: any = { upsert: upsertSpy.gsc_query_metrics }
      return ch
    }
    if (table === "gsc_page_metrics") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch: any = { upsert: upsertSpy.gsc_page_metrics }
      return ch
    }
    if (table === "products") return productsChain
    if (table === "gsc_url_inspections") return inspectionsChain
    // fallback
    return makeChain({ data: null, error: null })
  })

  return {
    client: { from: fromFn },
    spies: { upsertSpy, insertSpy, fromFn },
  }
}

// ---------------------------------------------------------------------------
// Request helper (mirror shipping-poll)
// ---------------------------------------------------------------------------

const makeReq = (auth?: string, search = "") =>
  ({
    headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) },
    nextUrl: { searchParams: new URLSearchParams(search) },
  }) as unknown as NextRequest

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const GSC_QUERY_ROWS = [
  { keys: ["2026-06-22", "쥴리씨 원피스"], clicks: 10, impressions: 100, ctr: 0.1, position: 3.5 },
]
const GSC_PAGE_ROWS = [
  { keys: ["2026-06-22", "https://jullyssy.shop/products/dress"], clicks: 5, impressions: 50, ctr: 0.1, position: 4.0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("CRON_SECRET", "test-secret")

  // GSC client 기본 mock
  getAccessToken.mockResolvedValue("fake-gsc-token")
  getSiteUrl.mockReturnValue("sc-domain:jullyssy.shop")
  searchAnalyticsQuery.mockResolvedValue([]) // 기본값: 빈 배열
  urlInspect.mockResolvedValue({
    verdict: "PASS",
    coverageState: "Submitted and indexed",
    indexingState: "INDEXING_ALLOWED",
    lastCrawlTime: null,
    crawledAs: "DESKTOP",
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cron/gsc-sync", () => {
  describe("인증", () => {
    it("Authorization 헤더 없음 → 401", async () => {
      const { client } = makeAdminClient()
      createAdminClient.mockReturnValue(client)

      const res = await POST(makeReq())
      expect(res.status).toBe(401)
    })

    it("잘못된 Bearer token → 401", async () => {
      const { client } = makeAdminClient()
      createAdminClient.mockReturnValue(client)

      const res = await POST(makeReq("Bearer wrong-token"))
      expect(res.status).toBe(401)
    })

    it("올바른 Bearer token → 401 아님", async () => {
      const { client } = makeAdminClient()
      createAdminClient.mockReturnValue(client)

      const res = await POST(makeReq("Bearer test-secret", "dryRun=1"))
      expect(res.status).not.toBe(401)
    })
  })

  describe("dryRun=1", () => {
    it("dryRun → 200 + dryRun:true", async () => {
      const { client } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      searchAnalyticsQuery.mockResolvedValue(GSC_QUERY_ROWS)

      const res = await POST(makeReq("Bearer test-secret", "dryRun=1"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.dryRun).toBe(true)
      expect(body.ok).toBe(true)
    })

    it("dryRun → gsc_query_metrics.upsert 미호출", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      searchAnalyticsQuery.mockResolvedValue(GSC_QUERY_ROWS)

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.upsertSpy.gsc_query_metrics).not.toHaveBeenCalled()
    })

    it("dryRun → gsc_page_metrics.upsert 미호출", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      // query call → empty, page call → pageRows
      searchAnalyticsQuery
        .mockResolvedValueOnce([]) // query dimensions
        .mockResolvedValueOnce(GSC_PAGE_ROWS) // page dimensions

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.upsertSpy.gsc_page_metrics).not.toHaveBeenCalled()
    })

    it("dryRun → gsc_sync_log에 insert 미호출 (쓰기 0)", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      searchAnalyticsQuery.mockResolvedValue([])

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.insertSpy).not.toHaveBeenCalled()
    })
  })

  describe("정상 경로 (non-dryRun)", () => {
    it("200 + ok:true", async () => {
      const { client } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      searchAnalyticsQuery
        .mockResolvedValueOnce(GSC_QUERY_ROWS)
        .mockResolvedValueOnce(GSC_PAGE_ROWS)

      const res = await POST(makeReq("Bearer test-secret"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("gsc_query_metrics.upsert 호출됨", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      searchAnalyticsQuery
        .mockResolvedValueOnce(GSC_QUERY_ROWS)
        .mockResolvedValueOnce(GSC_PAGE_ROWS)

      await POST(makeReq("Bearer test-secret"))

      expect(spies.upsertSpy.gsc_query_metrics).toHaveBeenCalledOnce()
      // upsert 인자에 date, query, clicks 등 포함 확인
      const queryCall = spies.upsertSpy.gsc_query_metrics.mock.calls[0] as unknown[]
      const rows = queryCall[0] as Array<Record<string, unknown>>
      const opts = queryCall[1] as Record<string, unknown>
      expect(Array.isArray(rows)).toBe(true)
      expect(rows[0]).toMatchObject({ date: "2026-06-22", query: "쥴리씨 원피스", clicks: 10 })
      expect(opts).toMatchObject({ onConflict: "date,query" })
    })

    it("gsc_page_metrics.upsert 호출됨 (page_path는 stripToPath 적용)", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      searchAnalyticsQuery
        .mockResolvedValueOnce([]) // query
        .mockResolvedValueOnce(GSC_PAGE_ROWS) // page

      await POST(makeReq("Bearer test-secret"))

      expect(spies.upsertSpy.gsc_page_metrics).toHaveBeenCalledOnce()
      const pageCall = spies.upsertSpy.gsc_page_metrics.mock.calls[0] as unknown[]
      const pageRows = pageCall[0] as Array<Record<string, unknown>>
      const pageOpts = pageCall[1] as Record<string, unknown>
      expect(pageRows[0]).toMatchObject({
        date: "2026-06-22",
        page_path: "/products/dress", // stripToPath 적용됨
      })
      expect(pageOpts).toMatchObject({ onConflict: "date,page_path" })
    })
  })
})
