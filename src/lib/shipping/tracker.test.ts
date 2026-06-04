import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getShippingTracker,
  resolveSweetTrackerCode,
  UnsupportedCourierError,
  TrackerApiError,
} from "./tracker"

const mockFetch = (payload: unknown, init?: { ok?: boolean; status?: number }) =>
  vi.fn().mockResolvedValue({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => payload,
  })

beforeEach(() => {
  vi.stubEnv("SWEET_TRACKER_API_KEY", "test-key")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("resolveSweetTrackerCode", () => {
  it("지원 택배사 라벨 → t_code", () => {
    expect(resolveSweetTrackerCode("CJ대한통운")).toBe("04")
    expect(resolveSweetTrackerCode("롯데택배")).toBe("08")
    expect(resolveSweetTrackerCode("한진택배")).toBe("05")
    expect(resolveSweetTrackerCode("우체국택배")).toBe("01")
  })
  it("앞뒤 공백 trim 후 매핑", () => {
    expect(resolveSweetTrackerCode(" CJ대한통운 ")).toBe("04")
  })
  it("미지원 라벨 → null", () => {
    expect(resolveSweetTrackerCode("로젠택배")).toBeNull()
  })
})

describe("SweetTrackerAdapter.fetchStatus", () => {
  it("completeYN='Y' → delivered + KST(+09:00) 완료시각 파싱", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        completeYN: "Y",
        level: 6,
        lastDetail: { timeString: "2026-06-05 14:30:00" },
      })
    )
    const r = await getShippingTracker().fetchStatus("CJ대한통운", "123")
    expect(r.delivered).toBe(true)
    expect(r.deliveredAt?.toISOString()).toBe("2026-06-05T05:30:00.000Z")
  })

  it("level>=6 단독으로도 delivered (lastDetail 없으면 deliveredAt null)", async () => {
    vi.stubGlobal("fetch", mockFetch({ level: 6 }))
    const r = await getShippingTracker().fetchStatus("한진택배", "123")
    expect(r.delivered).toBe(true)
    expect(r.deliveredAt).toBeNull()
  })

  it("배송중(completeYN='N', level<6) → not delivered", async () => {
    vi.stubGlobal("fetch", mockFetch({ completeYN: "N", level: 3 }))
    const r = await getShippingTracker().fetchStatus("CJ대한통운", "123")
    expect(r.delivered).toBe(false)
    expect(r.deliveredAt).toBeNull()
  })

  it("미지원 택배사 → UnsupportedCourierError (fetch 미호출)", async () => {
    const f = mockFetch({})
    vi.stubGlobal("fetch", f)
    await expect(
      getShippingTracker().fetchStatus("로젠택배", "123")
    ).rejects.toBeInstanceOf(UnsupportedCourierError)
    expect(f).not.toHaveBeenCalled()
  })

  it("에러 응답(status:false, 추적필드 없음) → TrackerApiError", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ status: false, code: "104", msg: "송장 미등록" })
    )
    await expect(
      getShippingTracker().fetchStatus("CJ대한통운", "123")
    ).rejects.toBeInstanceOf(TrackerApiError)
  })

  it("HTTP !ok → TrackerApiError", async () => {
    vi.stubGlobal("fetch", mockFetch({}, { ok: false, status: 500 }))
    await expect(
      getShippingTracker().fetchStatus("CJ대한통운", "123")
    ).rejects.toBeInstanceOf(TrackerApiError)
  })

  it("API 키 없음 → TrackerApiError", async () => {
    vi.stubEnv("SWEET_TRACKER_API_KEY", "")
    vi.stubGlobal("fetch", mockFetch({ completeYN: "Y" }))
    await expect(
      getShippingTracker().fetchStatus("CJ대한통운", "123")
    ).rejects.toBeInstanceOf(TrackerApiError)
  })
})
