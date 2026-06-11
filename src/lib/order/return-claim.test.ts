import { describe, it, expect, vi, beforeEach } from "vitest"

// US-013: claim 전이(승인/거절/철회/회수/환불/재발송/교환완료) 상태 가드 로직.
// 경계(Supabase/Toss/이메일)만 모킹하고 가드 분기는 실제로 통과시킨다.
const { createAdminClient, tossCancel } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  tossCancel: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/payment/toss-cancel", () => ({ tossCancel }))
vi.mock("@/lib/email/send", () => ({
  sendClaimApproved: vi.fn(),
  sendClaimRejected: vi.fn(),
  sendRefundCompleted: vi.fn(),
  sendShippingStarted: vi.fn(),
}))
vi.mock("@/lib/email/mappers", () => ({
  formatKST: (s: unknown) => String(s),
  getOrderDetailUrl: (id: string) => `https://x/orders/${id}`,
  getPaymentMethodLabel: (m: unknown) => String(m),
  getRefundEta: () => "영업일 3일",
  resolveUserEmail: vi.fn(async () => "user@test.com"),
}))
vi.mock("@/lib/order/tracking-url", () => ({ buildTrackingUrl: () => "https://track" }))

import {
  approveClaim,
  rejectClaim,
  withdrawClaim,
  markClaimCollected,
  executeReturnRefund,
  exchangeReship,
  completeExchange,
} from "./return-claim"

const DEFAULT_ORDER = {
  paid_amount: 10000,
  order_no: "20260611-0001",
  recipient: "홍길동",
  recipient_phone: "010-0000-0000",
  zipcode: "12345",
  address1: "서울시",
  address2: null,
  user_id: "u1",
  order_items: [],
  payments: [{ method: "CARD" }],
}

// from(table)별 응답을 돌려주는 최소 빌더. update/insert 이후 select는 updateRows 반환.
function mockAdmin(
  claim: Record<string, unknown> | null,
  opts?: { order?: Record<string, unknown>; updateRows?: unknown[] }
) {
  const builder = (table: string) => {
    const state = { isWrite: false }
    const resolve = () => {
      if (state.isWrite)
        return { data: opts?.updateRows ?? [{ id: "claim-1" }], error: null }
      if (table === "order_claims") return { data: claim, error: null }
      if (table === "orders")
        return { data: opts?.order ?? DEFAULT_ORDER, error: null }
      if (table === "payments")
        return { data: { payment_key: "pk_1" }, error: null }
      return { data: null, error: null }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: vi.fn(() => b),
      update: vi.fn(() => {
        state.isWrite = true
        return b
      }),
      insert: vi.fn(() => b),
      eq: vi.fn(() => b),
      in: vi.fn(() => b),
      single: vi.fn(() => Promise.resolve(resolve())),
      maybeSingle: vi.fn(() => Promise.resolve(resolve())),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (onF: any, onR: any) => Promise.resolve(resolve()).then(onF, onR),
    }
    return b
  }
  return {
    from: vi.fn((t: string) => builder(t)),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  }
}

beforeEach(() => vi.clearAllMocks())

describe("approveClaim", () => {
  it("클레임 없음 → 404", async () => {
    createAdminClient.mockReturnValue(mockAdmin(null))
    const r = await approveClaim("c1", 0, "admin")
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(404)
  })

  it("REQUESTED 아니면 409", async () => {
    createAdminClient.mockReturnValue(mockAdmin({ id: "c1", status: "APPROVED" }))
    const r = await approveClaim("c1", 0, "admin")
    if (!r.ok) expect(r.status).toBe(409)
    else throw new Error("should fail")
  })

  it("차감액 음수 → 400", async () => {
    createAdminClient.mockReturnValue(mockAdmin({ id: "c1", status: "REQUESTED" }))
    const r = await approveClaim("c1", -1, "admin")
    if (!r.ok) expect(r.status).toBe(400)
    else throw new Error("should fail")
  })

  it("정상(REQUESTED) → ok", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "REQUESTED", type: "RETURN", order_id: "o1" })
    )
    const r = await approveClaim("c1", 3500, "admin")
    expect(r.ok).toBe(true)
  })
})

describe("withdrawClaim (사용자)", () => {
  it("타인 클레임 → 403", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "REQUESTED", user_id: "other", order_id: "o1" })
    )
    const r = await withdrawClaim("c1", "me")
    if (!r.ok) expect(r.status).toBe(403)
    else throw new Error("should fail")
  })

  it("REQUESTED 아니면 409", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "APPROVED", user_id: "me", order_id: "o1" })
    )
    const r = await withdrawClaim("c1", "me")
    if (!r.ok) expect(r.status).toBe(409)
    else throw new Error("should fail")
  })
})

describe("rejectClaim / markClaimCollected", () => {
  it("rejectClaim: 사유 공백 → 400", async () => {
    createAdminClient.mockReturnValue(mockAdmin({ id: "c1", status: "REQUESTED" }))
    const r = await rejectClaim("c1", "   ", "admin")
    if (!r.ok) expect(r.status).toBe(400)
    else throw new Error("should fail")
  })

  it("markClaimCollected: APPROVED 아니면 409", async () => {
    createAdminClient.mockReturnValue(mockAdmin({ id: "c1", status: "REQUESTED" }))
    const r = await markClaimCollected("c1", "admin")
    if (!r.ok) expect(r.status).toBe(409)
    else throw new Error("should fail")
  })
})

describe("executeReturnRefund", () => {
  it("RETURN 아니면 400", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "COLLECTED", type: "EXCHANGE" })
    )
    const r = await executeReturnRefund("c1", "admin")
    if (!r.ok) expect(r.status).toBe(400)
    else throw new Error("should fail")
  })

  it("COLLECTED 아니면 409", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "APPROVED", type: "RETURN" })
    )
    const r = await executeReturnRefund("c1", "admin")
    if (!r.ok) expect(r.status).toBe(409)
    else throw new Error("should fail")
  })

  it("정상 → tossCancel(환불액=paid-차감) 호출 + RPC + ok", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({
        id: "c1",
        status: "COLLECTED",
        type: "RETURN",
        order_id: "o1",
        confirmed_deduction: 3500,
        proposed_deduction: 3500,
        toss_cancel_idempotency_key: null,
      })
    )
    tossCancel.mockResolvedValue({
      ok: true,
      balanceAmount: 0,
      paymentStatus: "PARTIAL_CANCELLED",
      raw: {},
    })
    const r = await executeReturnRefund("c1", "admin")
    expect(r.ok).toBe(true)
    expect(tossCancel).toHaveBeenCalledWith(
      "pk_1",
      expect.objectContaining({ cancelAmount: 6500 })
    )
  })

  it("멱등키 이미 존재 → tossCancel 재호출 안 함 (재시도 안전)", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({
        id: "c1",
        status: "COLLECTED",
        type: "RETURN",
        order_id: "o1",
        confirmed_deduction: 0,
        proposed_deduction: 0,
        toss_cancel_idempotency_key: "claim-return-c1",
      })
    )
    const r = await executeReturnRefund("c1", "admin")
    expect(r.ok).toBe(true)
    expect(tossCancel).not.toHaveBeenCalled()
  })
})

describe("exchangeReship / completeExchange", () => {
  it("exchangeReship: EXCHANGE 아니면 400", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "COLLECTED", type: "RETURN", order_id: "o1" })
    )
    const r = await exchangeReship("c1", "123", "CJ대한통운", "admin")
    if (!r.ok) expect(r.status).toBe(400)
    else throw new Error("should fail")
  })

  it("exchangeReship: 송장/택배사 공백 → 400", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "COLLECTED", type: "EXCHANGE", order_id: "o1" })
    )
    const r = await exchangeReship("c1", "", "", "admin")
    if (!r.ok) expect(r.status).toBe(400)
    else throw new Error("should fail")
  })

  it("completeExchange: RESHIPPED 아니면 409", async () => {
    createAdminClient.mockReturnValue(
      mockAdmin({ id: "c1", status: "COLLECTED", order_id: "o1" })
    )
    const r = await completeExchange("c1", "admin")
    if (!r.ok) expect(r.status).toBe(409)
    else throw new Error("should fail")
  })
})
