import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { UnsupportedCourierError, TrackerApiError } from "@/lib/shipping/tracker"

const {
  createAdminClient,
  fetchStatus,
  markOrderDelivered,
  captureException,
  captureMessage,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  fetchStatus: vi.fn(),
  markOrderDelivered: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/order/markOrderDelivered", () => ({ markOrderDelivered }))
vi.mock("@sentry/nextjs", () => ({ captureException, captureMessage }))
// getShippingTracker만 override, 에러 클래스는 실제 유지(instanceof 일치).
vi.mock("@/lib/shipping/tracker", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/shipping/tracker")>()
  return { ...actual, getShippingTracker: () => ({ fetchStatus }) }
})

import { POST } from "./route"

// select→eq→not→order→limit 체인 끝(limit)에서 대상 목록 반환.
function makeAdminClient(targets: unknown[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    not: vi.fn(() => b),
    order: vi.fn(() => b),
    limit: vi.fn(() => Promise.resolve({ data: targets, error: null })),
  }
  return { from: vi.fn(() => b) }
}

const makeReq = (auth?: string, dryRun = false) =>
  ({
    headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) },
    nextUrl: { searchParams: new URLSearchParams(dryRun ? "dryRun=1" : "") },
  }) as unknown as NextRequest

const TARGET = { id: "o1", courier: "CJ대한통운", tracking_no: "509604734075" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("CRON_SECRET", "secret")
})

describe("POST /api/cron/shipping-poll", () => {
  it("미인증 → 401", async () => {
    createAdminClient.mockReturnValue(makeAdminClient([]))
    const res = await POST(makeReq("Bearer wrong"))
    expect(res.status).toBe(401)
  })

  it("배송완료 감지 → transitioned (via SYSTEM + guardStatus SHIPPING)", async () => {
    createAdminClient.mockReturnValue(makeAdminClient([TARGET]))
    fetchStatus.mockResolvedValue({ delivered: true, deliveredAt: null })
    markOrderDelivered.mockResolvedValue({ status: "transitioned" })

    const res = await POST(makeReq("Bearer secret"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.transitioned).toBe(1)
    expect(markOrderDelivered).toHaveBeenCalledWith(
      expect.anything(),
      "o1",
      expect.objectContaining({ via: "SYSTEM", guardStatus: "SHIPPING" })
    )
  })

  it("미배송 → skipped (markOrderDelivered 미호출)", async () => {
    createAdminClient.mockReturnValue(makeAdminClient([TARGET]))
    fetchStatus.mockResolvedValue({ delivered: false, deliveredAt: null })

    const res = await POST(makeReq("Bearer secret"))
    const body = await res.json()
    expect(body.skipped).toBe(1)
    expect(body.transitioned).toBe(0)
    expect(markOrderDelivered).not.toHaveBeenCalled()
  })

  it("guard 불일치(이미 전이) → skipped (멱등)", async () => {
    createAdminClient.mockReturnValue(makeAdminClient([TARGET]))
    fetchStatus.mockResolvedValue({ delivered: true, deliveredAt: null })
    markOrderDelivered.mockResolvedValue({ status: "skipped" })

    const res = await POST(makeReq("Bearer secret"))
    const body = await res.json()
    expect(body.skipped).toBe(1)
    expect(body.transitioned).toBe(0)
  })

  it("미지원 택배사 → unsupported (Sentry 없음)", async () => {
    createAdminClient.mockReturnValue(
      makeAdminClient([{ ...TARGET, courier: "로젠택배" }])
    )
    fetchStatus.mockRejectedValue(new UnsupportedCourierError("로젠택배"))

    const res = await POST(makeReq("Bearer secret"))
    const body = await res.json()
    expect(body.unsupported).toBe(1)
    expect(captureException).not.toHaveBeenCalled()
  })

  it("API 실패 → failed + Sentry (건별 격리)", async () => {
    createAdminClient.mockReturnValue(makeAdminClient([TARGET]))
    fetchStatus.mockRejectedValue(new TrackerApiError("boom"))

    const res = await POST(makeReq("Bearer secret"))
    const body = await res.json()
    expect(body.failed).toBe(1)
    expect(captureException).toHaveBeenCalled()
  })

  it("dryRun=1 → 전환/메일 없이 wouldTransition 프리뷰 (markOrderDelivered 미호출)", async () => {
    createAdminClient.mockReturnValue(makeAdminClient([TARGET]))
    fetchStatus.mockResolvedValue({
      delivered: true,
      deliveredAt: new Date("2026-06-05T05:30:00Z"),
    })

    const res = await POST(makeReq("Bearer secret", true))
    const body = await res.json()
    expect(body.dryRun).toBe(true)
    expect(body.wouldTransition).toHaveLength(1)
    expect(body.wouldTransition[0].id).toBe("o1")
    expect(body.wouldTransition[0].deliveredAt).toBe("2026-06-05T05:30:00.000Z")
    expect(markOrderDelivered).not.toHaveBeenCalled()
  })
})
