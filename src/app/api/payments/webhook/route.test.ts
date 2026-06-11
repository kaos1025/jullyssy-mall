import { describe, it, expect, vi, beforeEach } from "vitest"

// US-012: webhook CANCEL_STATUS_CHANGED — 검증 이중경로(secret/역조회) + 시나리오 1/2/3 분기.
// timingSafeEqual은 실제(node:crypto) 사용. 경계(Supabase/Toss조회/cancelOrder/Sentry)만 모킹.
const {
  createAdminClient,
  getTossPayment,
  cancelOrder,
  addBreadcrumb,
  captureMessage,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getTossPayment: vi.fn(),
  cancelOrder: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@/lib/api-helpers/withRateLimit", () => ({
  withRateLimit: (_l: unknown, h: unknown) => h,
}))
vi.mock("@/lib/rate-limit/limiters", () => ({ paymentsLimiter: {} }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/payment/toss-cancel", () => ({ getTossPayment }))
vi.mock("@/lib/order/cancel-order", () => ({ cancelOrder }))
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb,
  captureMessage,
  captureException: vi.fn(),
}))

import { POST } from "./route"

const PK = "pk_test_123456789"

// payments row 조회 + update 통과 빌더. update payload는 captured에 적재.
function mockAdmin(
  paymentRow: Record<string, unknown> | null,
  captured?: { updates: unknown[] }
) {
  const builder = () => {
    const state = { isWrite: false }
    const resolve = () => {
      if (state.isWrite) return { data: [{}], error: null }
      return {
        data: paymentRow,
        error: paymentRow ? null : { message: "not found" },
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: vi.fn(() => b),
      update: vi.fn((p: unknown) => {
        state.isWrite = true
        captured?.updates.push(p)
        return b
      }),
      eq: vi.fn(() => b),
      single: vi.fn(() => Promise.resolve(resolve())),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (onF: any, onR: any) => Promise.resolve(resolve()).then(onF, onR),
    }
    return b
  }
  return { from: vi.fn(() => builder()) }
}

const req = (body: unknown) =>
  ({ json: async () => body }) as unknown as Request

beforeEach(() => vi.clearAllMocks())

describe("eventType 라우팅", () => {
  it("미처리 eventType → silent ignore", async () => {
    createAdminClient.mockReturnValue(mockAdmin(null))
    const res = await POST(req({ eventType: "FOO", data: {} }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, ignored: true })
  })
})

describe("PAYMENT_STATUS_CHANGED (기존 거동 보존)", () => {
  it("secret 일치 + DONE → success", async () => {
    createAdminClient.mockReturnValue(mockAdmin({ secret: "s1", order_id: "o1" }))
    const res = await POST(
      req({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: { paymentKey: PK, secret: "s1", status: "DONE" },
      })
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })
  })

  it("secret 불일치 → 401", async () => {
    createAdminClient.mockReturnValue(mockAdmin({ secret: "s1", order_id: "o1" }))
    const res = await POST(
      req({
        eventType: "PAYMENT_STATUS_CHANGED",
        data: { paymentKey: PK, secret: "WRONGWRONG", status: "DONE" },
      })
    )
    expect(res.status).toBe(401)
  })
})

describe("CANCEL_STATUS_CHANGED — 검증 이중 경로", () => {
  it("경로1: secret 일치 + 전액(잔액0) → cancelOrder(skipTossCancel) full_sync", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "DONE" })
    )
    getTossPayment.mockResolvedValue({
      ok: true,
      payment: { status: "CANCELED", balanceAmount: 0 },
    })
    cancelOrder.mockResolvedValue({ success: true })
    const res = await POST(
      req({ eventType: "CANCEL_STATUS_CHANGED", data: { paymentKey: PK, secret: "s1" } })
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      scenario: "full_sync",
    })
    expect(cancelOrder).toHaveBeenCalledWith(
      "o1",
      expect.objectContaining({ actor: "SYSTEM" }),
      { skipTossCancel: true }
    )
  })

  it("경로2: secret 부재 → 역조회 CANCELED → 통과(역조회 1회 재사용)", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "DONE" })
    )
    getTossPayment.mockResolvedValue({
      ok: true,
      payment: { status: "CANCELED", balanceAmount: 0 },
    })
    cancelOrder.mockResolvedValue({ success: true })
    const res = await POST(
      req({ eventType: "CANCEL_STATUS_CHANGED", data: { paymentKey: PK } })
    )
    expect(res.status).toBe(200)
    expect(getTossPayment).toHaveBeenCalledTimes(1)
  })

  it("경로2: secret 부재 + 역조회 status가 취소 아님(DONE) → 401 거부", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "DONE" })
    )
    getTossPayment.mockResolvedValue({
      ok: true,
      payment: { status: "DONE", balanceAmount: 10000 },
    })
    const res = await POST(
      req({ eventType: "CANCEL_STATUS_CHANGED", data: { paymentKey: PK } })
    )
    expect(res.status).toBe(401)
    expect(cancelOrder).not.toHaveBeenCalled()
  })

  it("secret 불일치 → 401 (역조회로 우회 불가)", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "DONE" })
    )
    const res = await POST(
      req({
        eventType: "CANCEL_STATUS_CHANGED",
        data: { paymentKey: PK, secret: "WRONGWRONG" },
      })
    )
    expect(res.status).toBe(401)
    expect(getTossPayment).not.toHaveBeenCalled()
  })
})

describe("CANCEL_STATUS_CHANGED — 시나리오 분기", () => {
  it("시나리오1: payments 이미 CANCELLED → no-op (토스조회/취소 없음)", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "CANCELLED" })
    )
    const res = await POST(
      req({ eventType: "CANCEL_STATUS_CHANGED", data: { paymentKey: PK, secret: "s1" } })
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true, scenario: "noop" })
    expect(getTossPayment).not.toHaveBeenCalled()
    expect(cancelOrder).not.toHaveBeenCalled()
  })

  it("시나리오3: 부분취소(잔액>0) → partial_manual + payments=PARTIAL_CANCELLED + warning", async () => {
    const captured = { updates: [] as unknown[] }
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "DONE" }, captured)
    )
    getTossPayment.mockResolvedValue({
      ok: true,
      payment: { status: "PARTIAL_CANCELED", balanceAmount: 3000 },
    })
    const res = await POST(
      req({ eventType: "CANCEL_STATUS_CHANGED", data: { paymentKey: PK, secret: "s1" } })
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      scenario: "partial_manual",
    })
    expect(cancelOrder).not.toHaveBeenCalled()
    expect(captured.updates[0]).toMatchObject({ status: "PARTIAL_CANCELLED" })
    expect(captureMessage).toHaveBeenCalledWith(
      "webhook_cancel_partial_manual",
      expect.anything()
    )
  })

  it("시나리오2 실패: cancelOrder 에러 → 500 + Sentry error", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ secret: "s1", order_id: "o1", status: "DONE" })
    )
    getTossPayment.mockResolvedValue({
      ok: true,
      payment: { status: "CANCELED", balanceAmount: 0 },
    })
    cancelOrder.mockResolvedValue({ error: "동기화 실패", status: 500 })
    const res = await POST(
      req({ eventType: "CANCEL_STATUS_CHANGED", data: { paymentKey: PK, secret: "s1" } })
    )
    expect(res.status).toBe(500)
    expect(captureMessage).toHaveBeenCalledWith(
      "webhook_cancel_full_sync_fail",
      expect.objectContaining({ level: "error" })
    )
  })
})
