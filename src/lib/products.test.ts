import { describe, it, expect, vi, beforeEach } from "vitest"

// 상품 목록/홈 fetcher 단위 테스트 — supabase admin 빌더·next/cache 경계만 모킹.
// 고정하는 것: (1) SELECT 화이트리스트에 상세 전용 대형 텍스트·내부 컬럼이 섞이지 않음(Egress 회귀 방지)
//            (2) 홈 fetcher의 쿼리 형태(ACTIVE·정렬 2종·limit)·분리 반환·에러 전파.

type Call = { method: string; args: unknown[] }
type Response = { data: unknown; error: { message: string } | null; count?: number }

const { createAdminClient, builders, setResponses } = vi.hoisted(() => {
  const builders: { calls: Call[] }[] = []
  // order 컬럼 → 응답 매핑(쿼리별 결과 분리 검증). 미지정 시 빈 결과.
  let responses: Record<string, Response> = {}
  const setResponses = (r: Record<string, Response>) => {
    responses = r
  }

  const makeBuilder = () => {
    const calls: Call[] = []
    builders.push({ calls })
    const b: Record<string, unknown> = {}
    for (const m of ["select", "eq", "in", "ilike", "order", "range", "limit"]) {
      b[m] = vi.fn((...args: unknown[]) => {
        calls.push({ method: m, args })
        return b
      })
    }
    // thenable — await/Promise.all 시점에 order 컬럼 기준으로 응답 선택
    b.then = (onFulfilled: (v: Response) => unknown, onRejected?: (e: unknown) => unknown) => {
      const orderCol = calls.find((c) => c.method === "order")?.args[0] as string | undefined
      const res = (orderCol && responses[orderCol]) || { data: [], error: null }
      return Promise.resolve(res).then(onFulfilled, onRejected)
    }
    return b
  }

  return {
    builders,
    setResponses,
    createAdminClient: vi.fn(() => ({ from: vi.fn(() => makeBuilder()) })),
  }
})

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))

import { PRODUCT_CARD_SELECT, getHomeProducts, getProductsList } from "./products"

// 목록 SELECT 금지 컬럼 — 상세 전용 대형 텍스트(spec P0-a) + 내부/네이버 매핑 컬럼.
const FORBIDDEN_LIST_COLUMNS = [
  "description",
  "description_raw",
  "meta_title",
  "meta_description",
  "material",
  "care_info",
  "origin",
  "search_tags",
  "sell_count",
  "naver_product_no",
  "view_count",
  "seo_updated_at",
]

// ProductCard가 실제 렌더하는 컬럼.
const REQUIRED_CARD_COLUMNS = [
  "id",
  "name",
  "slug",
  "price",
  "sale_price",
  "status",
  "created_at",
  "free_shipping",
  "product_images(url,is_thumbnail,sort_order)",
  "product_options(color)",
]

const compact = (select: string) => select.replace(/\s+/g, "")
const hasColumn = (select: string, col: string) => new RegExp(`\\b${col}\\b`).test(compact(select))

const callsOf = (b: { calls: Call[] }, method: string) =>
  b.calls.filter((c) => c.method === method).map((c) => c.args)

beforeEach(() => {
  builders.length = 0
  setResponses({})
  createAdminClient.mockClear()
})

describe("PRODUCT_CARD_SELECT (카드 화이트리스트 SSOT)", () => {
  it("금지 컬럼(대형 텍스트·내부) 미포함", () => {
    for (const col of FORBIDDEN_LIST_COLUMNS) {
      expect(hasColumn(PRODUCT_CARD_SELECT, col), `forbidden column leaked: ${col}`).toBe(false)
    }
    expect(compact(PRODUCT_CARD_SELECT)).not.toContain("*")
  })

  it("카드 실사용 컬럼 전부 포함", () => {
    const c = compact(PRODUCT_CARD_SELECT)
    for (const col of REQUIRED_CARD_COLUMNS) {
      expect(c, `missing card column: ${col}`).toContain(col)
    }
  })
})

describe("getProductsList (목록 SELECT = 카드 + reviews(count))", () => {
  it("목록 SELECT도 금지 컬럼 미포함 + reviews(count) 포함 + ACTIVE 필터", async () => {
    await getProductsList([], "latest", 0, 20)

    expect(builders).toHaveLength(1)
    const [selectArgs] = callsOf(builders[0], "select")
    const select = selectArgs[0] as string
    for (const col of FORBIDDEN_LIST_COLUMNS) {
      expect(hasColumn(select, col), `forbidden column leaked: ${col}`).toBe(false)
    }
    expect(compact(select)).toContain("reviews(count)")
    expect(selectArgs[1]).toEqual({ count: "exact" })
    expect(callsOf(builders[0], "eq")).toEqual([["status", "ACTIVE"]])
    // 빈 categoryIds → .in 미호출(0건 매치 함정 회피)
    expect(callsOf(builders[0], "in")).toEqual([])
    expect(callsOf(builders[0], "range")).toEqual([[0, 19]])
  })
})

describe("getHomeProducts (홈 신상품/인기상품 캐시 격리 fetcher)", () => {
  it("ACTIVE + created_at desc / sell_count desc + limit 8 두 쿼리, 결과 분리 반환", async () => {
    setResponses({
      created_at: { data: [{ id: "n1" }, { id: "n2" }], error: null },
      sell_count: { data: [{ id: "p1" }], error: null },
    })

    const result = await getHomeProducts()

    expect(result.newProducts.map((p) => p.id)).toEqual(["n1", "n2"])
    expect(result.popularProducts.map((p) => p.id)).toEqual(["p1"])

    expect(createAdminClient).toHaveBeenCalledTimes(1)
    expect(builders).toHaveLength(2)
    for (const b of builders) {
      expect(callsOf(b, "select")).toEqual([[PRODUCT_CARD_SELECT]])
      expect(callsOf(b, "eq")).toEqual([["status", "ACTIVE"]])
      expect(callsOf(b, "limit")).toEqual([[8]])
      expect(callsOf(b, "range")).toEqual([])
    }

    const orders = builders.map((b) => callsOf(b, "order")).flat()
    expect(orders).toEqual(
      expect.arrayContaining([
        ["created_at", { ascending: false }],
        ["sell_count", { ascending: false }],
      ])
    )
    expect(orders).toHaveLength(2)
  })

  it("신상품 쿼리 에러 → throw (빈 섹션 캐시 금지)", async () => {
    setResponses({
      created_at: { data: null, error: { message: "boom-new" } },
      sell_count: { data: [], error: null },
    })
    await expect(getHomeProducts()).rejects.toThrow("boom-new")
  })

  it("인기상품 쿼리 에러 → throw", async () => {
    setResponses({
      created_at: { data: [], error: null },
      sell_count: { data: null, error: { message: "boom-popular" } },
    })
    await expect(getHomeProducts()).rejects.toThrow("boom-popular")
  })

  it("data null → 빈 배열로 정규화", async () => {
    setResponses({
      created_at: { data: null, error: null },
      sell_count: { data: null, error: null },
    })
    await expect(getHomeProducts()).resolves.toEqual({ newProducts: [], popularProducts: [] })
  })
})
