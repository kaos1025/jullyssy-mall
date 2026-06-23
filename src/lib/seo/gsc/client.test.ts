import { describe, it, expect, vi } from "vitest"
import { searchAnalyticsQuery, urlInspect } from "./client"
import type { SearchAnalyticsQueryParams } from "./client"

// 공통 파라미터 기반 (accessToken, siteUrl, 날짜는 더미)
const BASE_PARAMS: Omit<SearchAnalyticsQueryParams, "dimensions"> = {
  siteUrl: "sc-domain:jullyssy.shop",
  accessToken: "fake-access-token",
  startDate: "2026-06-18",
  endDate: "2026-06-22",
  rowLimit: 2, // 페이지당 2행 — 픽스처를 최소화
}

// mock fetch 빌더: 호출마다 responses 배열에서 순서대로 응답 반환
function makeFetch(responses: { ok: boolean; body?: unknown; text?: string }[]) {
  let callIndex = 0
  return vi.fn<(url: string, opts?: RequestInit) => Promise<Response>>(async () => {
    const resp = responses[callIndex++]
    if (!resp) throw new Error("unexpected fetch call")
    return {
      ok: resp.ok,
      status: resp.ok ? 200 : 403,
      text: async () => resp.text ?? "",
      json: async () => resp.body ?? {},
    } as Response
  })
}

const ROW_A = { keys: ["쥴리씨 원피스", "2026-06-22"], clicks: 10, impressions: 100, ctr: 0.1, position: 3.5 }
const ROW_B = { keys: ["쥴리씨 블라우스", "2026-06-22"], clicks: 5, impressions: 50, ctr: 0.1, position: 4.0 }
const ROW_C = { keys: ["쥴리씨 치마", "2026-06-22"], clicks: 2, impressions: 20, ctr: 0.1, position: 5.0 }

describe("searchAnalyticsQuery", () => {
  it("Case A: 첫 페이지=rowLimit행, 둘째 페이지 < rowLimit → fetch 2회, 전체 행 집계", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { rows: [ROW_A, ROW_B] } },      // page 1: rowLimit(2) 행
      { ok: true, body: { rows: [ROW_C] } },              // page 2: 1행 < rowLimit → 종료
    ])

    const result = await searchAnalyticsQuery(
      { ...BASE_PARAMS, dimensions: ["query", "date"] },
      fetchMock as unknown as typeof fetch,
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(3)
    expect(result[0].keys).toEqual(ROW_A.keys)
    expect(result[2].keys).toEqual(ROW_C.keys)

    // 두 번째 호출의 body에 startRow가 rowLimit(2)로 전진됐는지 확인
    const secondCallBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as RequestInit).body as string,
    )
    expect(secondCallBody.startRow).toBe(2)
  })

  it("Case B: 단일 페이지 < rowLimit → fetch 1회", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { rows: [ROW_A] } }, // 1행 < rowLimit(2) → 종료
    ])

    const result = await searchAnalyticsQuery(
      { ...BASE_PARAMS, dimensions: ["query", "date"] },
      fetchMock as unknown as typeof fetch,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    // 첫 호출 body에 startRow=0
    const firstCallBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(firstCallBody.startRow).toBe(0)
    expect(firstCallBody.rowLimit).toBe(2)
  })

  it("Case C: 빈 rows → [] 반환 (fetch 1회)", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { rows: [] } },
    ])

    const result = await searchAnalyticsQuery(
      { ...BASE_PARAMS, dimensions: ["query"] },
      fetchMock as unknown as typeof fetch,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it("rows 필드 부재 응답 → [] 반환 (ok:true but no rows key)", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: {} }, // rows 없음
    ])

    const result = await searchAnalyticsQuery(
      { ...BASE_PARAMS, dimensions: ["query"] },
      fetchMock as unknown as typeof fetch,
    )

    expect(result).toEqual([])
  })

  it("non-2xx → Error throw", async () => {
    const fetchMock = makeFetch([
      { ok: false, text: "Forbidden" },
    ])

    await expect(
      searchAnalyticsQuery(
        { ...BASE_PARAMS, dimensions: ["query"] },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/HTTP 403/)
  })

  it("GscRow 필드 누락 시 기본값(0/[]) 채움", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { rows: [{}] } }, // 모든 필드 누락
    ])

    const result = await searchAnalyticsQuery(
      { ...BASE_PARAMS, dimensions: ["query"] },
      fetchMock as unknown as typeof fetch,
    )

    expect(result[0]).toEqual({ keys: [], clicks: 0, impressions: 0, ctr: 0, position: 0 })
  })
})

describe("urlInspect", () => {
  it("정상 응답 → 필드 매핑 반환", async () => {
    const fetchMock = makeFetch([
      {
        ok: true,
        body: {
          inspectionResult: {
            indexStatusResult: {
              verdict: "PASS",
              coverageState: "Submitted and indexed",
              indexingState: "INDEXING_ALLOWED",
              lastCrawlTime: "2026-06-20T12:00:00Z",
              crawledAs: "DESKTOP",
            },
          },
        },
      },
    ])

    const result = await urlInspect(
      {
        siteUrl: "sc-domain:jullyssy.shop",
        accessToken: "fake-token",
        inspectionUrl: "https://jullyssy.shop/products/dress",
      },
      fetchMock as unknown as typeof fetch,
    )

    expect(result.verdict).toBe("PASS")
    expect(result.coverageState).toBe("Submitted and indexed")
    expect(result.indexingState).toBe("INDEXING_ALLOWED")
    expect(result.lastCrawlTime).toBe("2026-06-20T12:00:00Z")
    expect(result.crawledAs).toBe("DESKTOP")
  })

  it("inspectionResult 없음 → 모든 필드 null", async () => {
    const fetchMock = makeFetch([
      { ok: true, body: {} },
    ])

    const result = await urlInspect(
      {
        siteUrl: "sc-domain:jullyssy.shop",
        accessToken: "fake-token",
        inspectionUrl: "https://jullyssy.shop/",
      },
      fetchMock as unknown as typeof fetch,
    )

    expect(result.verdict).toBeNull()
    expect(result.coverageState).toBeNull()
    expect(result.indexingState).toBeNull()
    expect(result.lastCrawlTime).toBeNull()
    expect(result.crawledAs).toBeNull()
  })

  it("non-2xx → Error throw", async () => {
    const fetchMock = makeFetch([{ ok: false, text: "Unauthorized" }])

    await expect(
      urlInspect(
        {
          siteUrl: "sc-domain:jullyssy.shop",
          accessToken: "bad-token",
          inspectionUrl: "https://jullyssy.shop/",
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/HTTP/)
  })
})
