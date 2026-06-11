import { describe, it, expect } from "vitest"
import { computeExcludedProductIds, type QueueDedupRow } from "./queue-dedup"

const STALE_MS = 30 * 60 * 1000 // 30분
const NOW = Date.parse("2026-06-11T10:00:00.000Z")

const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe("computeExcludedProductIds (backfill dedup — stale processing 제외)", () => {
  it("pending 행은 항상 제외", () => {
    const rows: QueueDedupRow[] = [
      { product_id: "p1", status: "pending", started_at: null },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded.has("p1")).toBe(true)
  })

  it("진행 중(fresh) processing 행은 제외 (started_at이 stale 미만)", () => {
    const rows: QueueDedupRow[] = [
      // 10분 전 시작 → 30분 미만 → 정상 진행 중
      { product_id: "p2", status: "processing", started_at: iso(-10 * 60 * 1000) },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded.has("p2")).toBe(true)
  })

  it("stale processing 행은 제외하지 않음 (재적재 허용)", () => {
    const rows: QueueDedupRow[] = [
      // 45분 전 시작 → 30분 초과 → stuck으로 간주
      { product_id: "p3", status: "processing", started_at: iso(-45 * 60 * 1000) },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded.has("p3")).toBe(false)
  })

  it("경계값: 정확히 staleMs 경과한 processing 행은 제외 (<=는 stale 아님)", () => {
    const rows: QueueDedupRow[] = [
      { product_id: "p4", status: "processing", started_at: iso(-STALE_MS) },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded.has("p4")).toBe(true)
  })

  it("started_at이 null인 processing 행은 보수적으로 제외", () => {
    const rows: QueueDedupRow[] = [
      { product_id: "p5", status: "processing", started_at: null },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded.has("p5")).toBe(true)
  })

  it("started_at이 파싱 불가인 processing 행은 보수적으로 제외", () => {
    const rows: QueueDedupRow[] = [
      { product_id: "p6", status: "processing", started_at: "not-a-date" },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded.has("p6")).toBe(true)
  })

  it("혼합: pending + fresh processing 제외, stale processing만 재적재 허용", () => {
    const rows: QueueDedupRow[] = [
      { product_id: "a", status: "pending", started_at: null },
      { product_id: "b", status: "processing", started_at: iso(-5 * 60 * 1000) },
      { product_id: "c", status: "processing", started_at: iso(-60 * 60 * 1000) },
    ]
    const excluded = computeExcludedProductIds(rows, STALE_MS, NOW)
    expect(excluded).toEqual(new Set(["a", "b"]))
    expect(excluded.has("c")).toBe(false)
  })

  it("빈 입력 → 빈 집합", () => {
    expect(computeExcludedProductIds([], STALE_MS, NOW).size).toBe(0)
  })
})
