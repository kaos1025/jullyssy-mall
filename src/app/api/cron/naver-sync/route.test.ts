import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const {
  createAdminClient,
  getNaverAccessToken,
  captureException,
  revalidateTag,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getNaverAccessToken: vi.fn(),
  captureException: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/naver", () => ({
  getNaverAccessToken,
  NAVER_API_BASE: "https://naver-api.test",
}))
vi.mock("@sentry/nextjs", () => ({ captureException }))
vi.mock("next/cache", () => ({ revalidateTag }))

import { POST } from "./route"

// ---------------------------------------------------------------------------
// Global fetch mock (네이버 API 호출)
// ---------------------------------------------------------------------------

// 기본 Naver search 응답: 빈 contents
const defaultSearchResponse = (): Response =>
  new Response(JSON.stringify({ contents: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

// ---------------------------------------------------------------------------
// Supabase admin mock builder
// ---------------------------------------------------------------------------

/**
 * 라우트의 체인:
 * - load_targets: from("products").select().not().neq() → TargetProduct[]
 * - OUTOFSTOCK:   from("product_options").update({ stock: 0 }).in()
 * - HIDDEN:       from("products").update({ status: "HIDDEN" }).eq()
 * - SALE stage2:  from("product_options").update({ stock: N }).eq()
 * - finalize:     from("naver_sync_logs").insert()
 * - fatal catch:  from("naver_sync_logs").insert().then()
 */

interface ProductOptionRow {
  id: string
  naver_option_id: string | null
  stock: number | null
}
interface ProductRow {
  id: string
  naver_product_no: string
  product_options: ProductOptionRow[] | null
}

interface MockOptions {
  products?: ProductRow[]
}

function makeAdminClient(opts: MockOptions = {}) {
  const { products = [] } = opts

  // 개별 update 호출 기록용 spy: 테스트에서 호출 인자를 검사할 수 있도록.
  const productOptionsUpdateSpy = vi.fn()
  const productsUpdateSpy = vi.fn()
  const naverSyncLogsInsertSpy = vi.fn()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeChain = (terminalValue: unknown): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch: any = {
      select: vi.fn(() => ch),
      eq: vi.fn(() => ch),
      not: vi.fn(() => ch),
      neq: vi.fn(() => ch),
      in: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ch),
      insert: vi.fn(() => {
        // insert().then() 패턴(에러 핸들러) 지원
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const insertCh: any = {
          then: (resolve: (v: unknown) => void) =>
            Promise.resolve({ data: null, error: null }).then(resolve),
        }
        return insertCh
      }),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve(terminalValue).then(resolve),
    }
    return ch
  }

  // products 테이블 체인: select().not().neq() → products 배열 반환.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsChain: any = {
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    // neq() 가 terminal(Promise)
    neq: vi.fn().mockResolvedValue({ data: products, error: null }),
    // update() → 별도 체인(spy 기록)
    update: vi.fn((payload: Record<string, unknown>) => {
      productsUpdateSpy(payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updCh: any = {
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        in: vi.fn(() => Promise.resolve({ data: null, error: null })),
      }
      return updCh
    }),
  }

  // product_options 테이블 체인: update().in() or update().eq()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productOptionsChain: any = {
    update: vi.fn((payload: Record<string, unknown>) => {
      productOptionsUpdateSpy(payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updCh: any = {
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        in: vi.fn(() => Promise.resolve({ data: null, error: null })),
      }
      return updCh
    }),
  }

  // naver_sync_logs 테이블 체인: insert() or insert().then()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const naverSyncLogsChain: any = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      naverSyncLogsInsertSpy(payload)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertCh: any = {
        then: (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(resolve),
      }
      return insertCh
    }),
  }

  const fromFn = vi.fn((table: string) => {
    if (table === "products") return productsChain
    if (table === "product_options") return productOptionsChain
    if (table === "naver_sync_logs") return naverSyncLogsChain
    return makeChain({ data: null, error: null })
  })

  return {
    client: { from: fromFn },
    spies: {
      fromFn,
      productOptionsUpdateSpy,
      productsUpdateSpy,
      naverSyncLogsInsertSpy,
    },
  }
}

// ---------------------------------------------------------------------------
// Request helper (gsc-sync 패턴 미러)
// ---------------------------------------------------------------------------

const makeReq = (auth?: string, search = "") =>
  ({
    headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) },
    nextUrl: { searchParams: new URLSearchParams(search) },
  }) as unknown as NextRequest

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/** 단일 상품 search 응답 빌더 */
const makeSearchResponse = (
  items: Array<{
    originProductNo: number
    statusType: string
    channelProductNo?: number
  }>,
): Response =>
  new Response(
    JSON.stringify({
      contents: items.map((item) => ({
        originProductNo: item.originProductNo,
        channelProducts: [
          {
            channelProductNo: item.channelProductNo ?? item.originProductNo + 1000,
            statusType: item.statusType,
          },
        ],
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )

/** 상세 응답 빌더 (SALE stage2 용) */
const makeDetailResponse = (
  optionCombinations: Array<{ id: number; stockQuantity: number }>,
): Response =>
  new Response(
    JSON.stringify({
      originProduct: {
        stockQuantity: optionCombinations[0]?.stockQuantity ?? 0,
        detailAttribute: {
          optionInfo: {
            optionCombinations,
          },
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("CRON_SECRET", "test-secret")

  getNaverAccessToken.mockResolvedValue("fake-naver-token")

  // 기본 fetch: search → 빈 결과 (HIDDEN 처리 경로가 기본)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(defaultSearchResponse()))
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cron/naver-sync", () => {
  // ── 인증 ───────────────────────────────────────────────────────────────
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
      const { client } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      const res = await POST(makeReq("Bearer test-secret", "dryRun=1"))
      expect(res.status).not.toBe(401)
    })
  })

  // ── dryRun ─────────────────────────────────────────────────────────────
  describe("dryRun=1", () => {
    it("dryRun → 200 + dryRun:true", async () => {
      const { client } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      const res = await POST(makeReq("Bearer test-secret", "dryRun=1"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.dryRun).toBe(true)
      expect(body.ok).toBe(true)
    })

    it("dryRun → product_options.update 미호출 (OUTOFSTOCK 상품 있어도)", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-1",
          naver_product_no: "111",
          product_options: [{ id: "opt-1", naver_option_id: "n1", stock: 10 }],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      // search → OUTOFSTOCK
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          makeSearchResponse([{ originProductNo: 111, statusType: "OUTOFSTOCK", channelProductNo: 1111 }]),
        ),
      )

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.productOptionsUpdateSpy).not.toHaveBeenCalled()
    })

    it("dryRun → products.update 미호출 (삭제된 상품 있어도)", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-2",
          naver_product_no: "222",
          product_options: [],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      // search → 빈 contents (= 스토어 삭제 → HIDDEN 경로)
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ contents: [] }), { status: 200 })),
      )

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.productsUpdateSpy).not.toHaveBeenCalled()
    })

    it("dryRun → naver_sync_logs.insert 미호출 (쓰기 0)", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-3",
          naver_product_no: "333",
          product_options: [{ id: "opt-3", naver_option_id: "n3", stock: 5 }],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          makeSearchResponse([{ originProductNo: 333, statusType: "SALE", channelProductNo: 3333 }]),
        ),
      )
      // stage2 detail 도 mock 해야 fetch가 두 번 호출됨
      // 두 번째 호출(상세)도 간단한 응답 반환
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            makeSearchResponse([{ originProductNo: 333, statusType: "SALE", channelProductNo: 3333 }]),
          )
          .mockResolvedValueOnce(makeDetailResponse([{ id: 999, stockQuantity: 7 }])),
      )

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.naverSyncLogsInsertSpy).not.toHaveBeenCalled()
    })
  })

  // ── statusType 매핑 (non-dryRun) ───────────────────────────────────────
  describe("statusType 매핑 (non-dryRun)", () => {
    it("OUTOFSTOCK → product_options.update({ stock: 0 }) 호출됨", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-out",
          naver_product_no: "500",
          product_options: [
            { id: "opt-a", naver_option_id: "na", stock: 10 },
            { id: "opt-b", naver_option_id: "nb", stock: 5 },
          ],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          makeSearchResponse([{ originProductNo: 500, statusType: "OUTOFSTOCK", channelProductNo: 5001 }]),
        ),
      )

      await POST(makeReq("Bearer test-secret"))

      expect(spies.productOptionsUpdateSpy).toHaveBeenCalledWith({ stock: 0 })
    })

    it("SUSPENSION → product_options.update({ stock: 0 }) 호출됨 (비-SALE 모두 품절)", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-sus",
          naver_product_no: "501",
          product_options: [{ id: "opt-c", naver_option_id: "nc", stock: 3 }],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          makeSearchResponse([{ originProductNo: 501, statusType: "SUSPENSION", channelProductNo: 5011 }]),
        ),
      )

      await POST(makeReq("Bearer test-secret"))

      expect(spies.productOptionsUpdateSpy).toHaveBeenCalledWith({ stock: 0 })
    })

    it("검색 미반환(스토어 삭제) → products.update({ status: 'HIDDEN' }) 호출됨", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-del",
          naver_product_no: "600",
          product_options: [],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      // search → 빈 contents (미반환 = 스토어 삭제)
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ contents: [] }), { status: 200 }),
        ),
      )

      await POST(makeReq("Bearer test-secret"))

      expect(spies.productsUpdateSpy).toHaveBeenCalledWith({ status: "HIDDEN" })
    })

    it("SALE → stage2 상세 조회 후 product_options.update({ stock: N }) 호출됨", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-sale",
          naver_product_no: "700",
          product_options: [
            { id: "opt-sale-1", naver_option_id: "77001", stock: 0 },
          ],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      // 1단 search → SALE
      // 2단 detail → optionCombinations with matching naver_option_id=77001
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            makeSearchResponse([{ originProductNo: 700, statusType: "SALE", channelProductNo: 7001 }]),
          )
          .mockResolvedValueOnce(
            makeDetailResponse([{ id: 77001, stockQuantity: 15 }]),
          ),
      )

      await POST(makeReq("Bearer test-secret"))

      // stock이 15로 갱신됨
      expect(spies.productOptionsUpdateSpy).toHaveBeenCalledWith({ stock: 15 })
    })

    it("SALE → 200 + ok:true", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-sale-2",
          naver_product_no: "701",
          product_options: [
            { id: "opt-sale-2", naver_option_id: "77002", stock: 0 },
          ],
        },
      ]
      const { client } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            makeSearchResponse([{ originProductNo: 701, statusType: "SALE", channelProductNo: 7011 }]),
          )
          .mockResolvedValueOnce(
            makeDetailResponse([{ id: 77002, stockQuantity: 8 }]),
          ),
      )

      const res = await POST(makeReq("Bearer test-secret"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("non-dryRun 정상 경로 → naver_sync_logs.insert 호출됨", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-log",
          naver_product_no: "800",
          product_options: [{ id: "opt-log", naver_option_id: "88001", stock: 0 }],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            makeSearchResponse([{ originProductNo: 800, statusType: "SALE", channelProductNo: 8001 }]),
          )
          .mockResolvedValueOnce(
            makeDetailResponse([{ id: 88001, stockQuantity: 3 }]),
          ),
      )

      await POST(makeReq("Bearer test-secret"))

      expect(spies.naverSyncLogsInsertSpy).toHaveBeenCalledOnce()
      const insertArg = spies.naverSyncLogsInsertSpy.mock.calls[0][0] as Record<string, unknown>
      expect(insertArg).toMatchObject({ sync_type: "STOCK_SYNC" })
    })
  })

  // ── 가격 미터치 (CRITICAL) ──────────────────────────────────────────────
  describe("가격/설명 미터치 (CRITICAL)", () => {
    const PRICE_KEYS = ["price", "sale_price", "description"]

    /** update spy가 PRICE_KEYS를 포함하는지 검사 */
    const assertNoPriceKeys = (
      calls: Array<[Record<string, unknown>]>,
      label: string,
    ) => {
      for (const [payload] of calls) {
        for (const key of PRICE_KEYS) {
          expect(
            Object.prototype.hasOwnProperty.call(payload, key),
            `${label}: update payload에 '${key}' 키가 포함되어서는 안 됩니다`,
          ).toBe(false)
        }
      }
    }

    it("OUTOFSTOCK 경로 → product_options.update 인자에 price/sale_price/description 없음", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-price-1",
          naver_product_no: "900",
          product_options: [{ id: "opt-p1", naver_option_id: "np1", stock: 10 }],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          makeSearchResponse([{ originProductNo: 900, statusType: "OUTOFSTOCK", channelProductNo: 9001 }]),
        ),
      )

      await POST(makeReq("Bearer test-secret"))

      assertNoPriceKeys(
        spies.productOptionsUpdateSpy.mock.calls as Array<[Record<string, unknown>]>,
        "product_options.update (OUTOFSTOCK)",
      )
      assertNoPriceKeys(
        spies.productsUpdateSpy.mock.calls as Array<[Record<string, unknown>]>,
        "products.update (OUTOFSTOCK)",
      )
    })

    it("HIDDEN 경로 → products.update 인자에 price/sale_price/description 없음", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-price-2",
          naver_product_no: "901",
          product_options: [],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ contents: [] }), { status: 200 }),
        ),
      )

      await POST(makeReq("Bearer test-secret"))

      assertNoPriceKeys(
        spies.productsUpdateSpy.mock.calls as Array<[Record<string, unknown>]>,
        "products.update (HIDDEN)",
      )
    })

    it("SALE stage2 경로 → product_options.update 인자에 price/sale_price/description 없음", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-price-3",
          naver_product_no: "902",
          product_options: [{ id: "opt-p3", naver_option_id: "np3", stock: 0 }],
        },
      ]
      const { client, spies } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            makeSearchResponse([{ originProductNo: 902, statusType: "SALE", channelProductNo: 9021 }]),
          )
          .mockResolvedValueOnce(
            makeDetailResponse([{ id: parseInt("np3"), stockQuantity: 20 }]),
          ),
      )

      await POST(makeReq("Bearer test-secret"))

      assertNoPriceKeys(
        spies.productOptionsUpdateSpy.mock.calls as Array<[Record<string, unknown>]>,
        "product_options.update (SALE stage2)",
      )
      assertNoPriceKeys(
        spies.productsUpdateSpy.mock.calls as Array<[Record<string, unknown>]>,
        "products.update (SALE stage2)",
      )
    })
  })

  // ── 엣지 케이스 ─────────────────────────────────────────────────────────
  describe("엣지 케이스", () => {
    it("대상 상품 0건 → 200 + total:0 (naver_sync_logs.insert 호출)", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      const res = await POST(makeReq("Bearer test-secret"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.total).toBe(0)
      // 빈 targets → 조기 반환 경로에서 naver_sync_logs.insert 호출
      expect(spies.naverSyncLogsInsertSpy).toHaveBeenCalledOnce()
    })

    it("대상 상품 0건 + dryRun → naver_sync_logs.insert 미호출", async () => {
      const { client, spies } = makeAdminClient({ products: [] })
      createAdminClient.mockReturnValue(client)

      await POST(makeReq("Bearer test-secret", "dryRun=1"))

      expect(spies.naverSyncLogsInsertSpy).not.toHaveBeenCalled()
    })

    it("search API 실패(non-200) → failCount 증가 + 200 ok:true (격리 처리)", async () => {
      const products: ProductRow[] = [
        {
          id: "prod-fail",
          naver_product_no: "999",
          product_options: [],
        },
      ]
      const { client } = makeAdminClient({ products })
      createAdminClient.mockReturnValue(client)

      // search 실패 응답
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 })),
      )

      const res = await POST(makeReq("Bearer test-secret"))
      expect(res.status).toBe(200)
      const body = await res.json()
      // 청크 실패는 격리 처리되어 ok:true 유지(pg_net 재시도 폭주 방지)
      expect(body.ok).toBe(true)
    })

    it("CRON_SECRET 미설정 → 어떤 요청도 401", async () => {
      vi.stubEnv("CRON_SECRET", "")
      const { client } = makeAdminClient()
      createAdminClient.mockReturnValue(client)

      // 빈 CRON_SECRET일 때 isAuthorized = false
      const res = await POST(makeReq("Bearer "))
      expect(res.status).toBe(401)
    })
  })
})
