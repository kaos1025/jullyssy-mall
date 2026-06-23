import { describe, it, expect } from "vitest"
import {
  restorePrivateKey,
  stripToPath,
  toGscDate,
  trailingWindow,
  isOtherBucket,
  toQueryMetricRows,
  toPageMetricRows,
} from "./helpers"
import type { GscRow } from "./client"

describe("restorePrivateKey", () => {
  it("리터럴 \\\\n → 실제 개행으로 변환", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\\nABCDEF\\n-----END PRIVATE KEY-----"
    const result = restorePrivateKey(raw)
    expect(result).toBe("-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----")
    expect(result).not.toContain("\\n")
  })

  it("이미 실제 개행이 있으면 그대로 반환", () => {
    const raw = "-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----"
    const result = restorePrivateKey(raw)
    expect(result).toBe(raw)
  })

  it("빈 문자열은 빈 문자열 반환", () => {
    expect(restorePrivateKey("")).toBe("")
  })
})

describe("stripToPath", () => {
  it("전체 URL → pathname만 반환", () => {
    expect(stripToPath("https://jullyssy.shop/products/dress-01")).toBe("/products/dress-01")
  })

  it("쿼리스트링 포함 URL → pathname만 반환", () => {
    expect(stripToPath("https://jullyssy.shop/products?page=2")).toBe("/products")
  })

  it("해시 포함 URL → pathname만 반환", () => {
    expect(stripToPath("https://jullyssy.shop/guide#section")).toBe("/guide")
  })

  it("경로에 쿼리스트링 → path만 반환", () => {
    expect(stripToPath("/products?sort=asc")).toBe("/products")
  })

  it("경로에 해시 → path만 반환", () => {
    expect(stripToPath("/guide#top")).toBe("/guide")
  })

  it("후행 슬래시 유지 (GSC는 구별)", () => {
    expect(stripToPath("https://jullyssy.shop/")).toBe("/")
  })

  it("선행 슬래시 없는 경로 → 선행 슬래시 추가", () => {
    expect(stripToPath("products/dress")).toBe("/products/dress")
  })

  it("선행 슬래시 있는 경로는 그대로", () => {
    expect(stripToPath("/products/dress")).toBe("/products/dress")
  })
})

describe("toGscDate", () => {
  it("알려진 날짜 → 'YYYY-MM-DD' (UTC 기준)", () => {
    // 2026-06-23T00:00:00Z → '2026-06-23'
    expect(toGscDate(new Date("2026-06-23T00:00:00Z"))).toBe("2026-06-23")
  })

  it("월/일이 두 자리로 패딩됨", () => {
    // 2026-01-05
    expect(toGscDate(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05")
  })

  it("UTC 기준 — 로컬 시간대 차이 무관", () => {
    // 2026-06-23T23:59:59Z 는 UTC 기준 여전히 2026-06-23
    expect(toGscDate(new Date("2026-06-23T23:59:59Z"))).toBe("2026-06-23")
  })
})

describe("trailingWindow", () => {
  const TODAY = new Date("2026-06-23T00:00:00Z")

  it("today=2026-06-23, days=5 → endDate=2026-06-22, startDate=2026-06-18", () => {
    const { startDate, endDate } = trailingWindow(TODAY, 5)
    expect(endDate).toBe("2026-06-22")
    expect(startDate).toBe("2026-06-18")
  })

  it("days=1 → endDate=어제, startDate=어제 (단일 일)", () => {
    const { startDate, endDate } = trailingWindow(TODAY, 1)
    expect(endDate).toBe("2026-06-22")
    expect(startDate).toBe("2026-06-22")
  })

  it("days=7 → endDate=2026-06-22, startDate=2026-06-16", () => {
    const { startDate, endDate } = trailingWindow(TODAY, 7)
    expect(endDate).toBe("2026-06-22")
    expect(startDate).toBe("2026-06-16")
  })
})

describe("isOtherBucket", () => {
  it("'(other)' → true", () => {
    expect(isOtherBucket("(other)")).toBe(true)
  })

  it("일반 쿼리 → false", () => {
    expect(isOtherBucket("쥴리씨 원피스")).toBe(false)
  })

  it("빈 문자열 → false", () => {
    expect(isOtherBucket("")).toBe(false)
  })

  it("공백 포함 → false", () => {
    expect(isOtherBucket(" (other)")).toBe(false)
  })
})

const FETCHED_AT = "2026-06-23T01:00:00.000Z"

describe("toQueryMetricRows", () => {
  it("GscRow(keys=[date,query]) → gsc_query_metrics 행 매핑", () => {
    const rows: GscRow[] = [
      { keys: ["2026-06-22", "쥴리씨 원피스"], clicks: 10, impressions: 100, ctr: 0.1, position: 3.5 },
    ]
    expect(toQueryMetricRows(rows, FETCHED_AT)).toEqual([
      {
        date: "2026-06-22",
        query: "쥴리씨 원피스",
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 3.5,
        data_state: "all",
        fetched_at: FETCHED_AT,
      },
    ])
  })

  it("(other) 버킷도 그대로 query로 보존", () => {
    const rows: GscRow[] = [
      { keys: ["2026-06-22", "(other)"], clicks: 0, impressions: 5, ctr: 0, position: 9 },
    ]
    expect(toQueryMetricRows(rows, FETCHED_AT)[0].query).toBe("(other)")
  })

  it("빈 입력 → 빈 배열", () => {
    expect(toQueryMetricRows([], FETCHED_AT)).toEqual([])
  })
})

describe("toPageMetricRows", () => {
  it("page 키를 stripToPath로 경로만 추출해 매핑", () => {
    const rows: GscRow[] = [
      { keys: ["2026-06-22", "https://jullyssy.shop/products/abc?x=1"], clicks: 2, impressions: 20, ctr: 0.1, position: 4 },
    ]
    const out = toPageMetricRows(rows, FETCHED_AT)
    expect(out[0].page_path).toBe("/products/abc")
    expect(out[0].data_state).toBe("all")
    expect(out[0].fetched_at).toBe(FETCHED_AT)
  })
})
