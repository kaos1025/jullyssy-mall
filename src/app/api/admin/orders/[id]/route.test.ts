import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"

// 회귀 1순위: markOrderDelivered 추출 후에도 admin 수동 "배송완료" 경로가
// status=DELIVERED + delivered_at + delivered_via='ADMIN' + 배송완료 메일을 모두 유지하는가.
// 라우트→markOrderDelivered는 "실제"로 통과시키고 경계(Supabase/이메일/인증)만 모킹한다.

// 경계 모킹 — spy는 vi.hoisted로 생성(팩토리 호이스팅 안전).
const {
  createAdminClient,
  verifyAdmin,
  sendShippingDelivered,
  sendShippingStarted,
  resolveUserEmail,
  captureMessage,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  verifyAdmin: vi.fn(),
  sendShippingDelivered: vi.fn(),
  sendShippingStarted: vi.fn(),
  resolveUserEmail: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@/lib/api-helpers/withRateLimit", () => ({
  withRateLimit: (_limiter: unknown, handler: unknown) => handler,
}))
vi.mock("@/lib/rate-limit/limiters", () => ({ adminLimiter: {} }))
vi.mock("@/lib/api-helpers/verifyAdmin", () => ({ verifyAdmin }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@sentry/nextjs", () => ({
  captureMessage,
  captureException: vi.fn(),
}))
vi.mock("@/lib/email/send", () => ({ sendShippingDelivered, sendShippingStarted }))
vi.mock("@/lib/email/mappers", () => ({
  resolveUserEmail,
  formatKST: (s: string) => s,
  getOrderDetailUrl: (id: string) => `https://x/orders/${id}`,
}))

import { PATCH } from "./route"

const ORDER_ID = "order-1"

// from()마다 새 builder(상태 격리). select/eq/...는 체이닝, single()·await는 결과 반환.
// update payload는 captured에 적재해 assert.
function makeAdminClient(opts: {
  currentOrder: unknown
  orderFull: unknown
  captured: { updatePayloads: unknown[] }
}) {
  const builder = () => {
    const state = { isUpdate: false, selectArg: null as string | null }
    const resolve = () => {
      if (state.isUpdate) return { data: [{ id: ORDER_ID }], error: null }
      if (state.selectArg === "*, order_items(*)")
        return { data: opts.orderFull, error: null }
      return { data: opts.currentOrder, error: null }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: vi.fn((arg?: string) => {
        state.selectArg = arg ?? null
        return b
      }),
      update: vi.fn((payload: unknown) => {
        state.isUpdate = true
        opts.captured.updatePayloads.push(payload)
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

const makeReq = (body: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest

const ORDER_FULL = {
  id: ORDER_ID,
  user_id: "user-1",
  order_no: "20260605-0001",
  recipient: "홍길동",
  recipient_phone: "010-0000-0000",
  zipcode: "12345",
  address1: "서울시",
  address2: null,
  courier: "CJ대한통운",
  tracking_no: "509604734075",
  delivered_at: "2026-06-05T05:30:00.000Z",
  updated_at: "2026-06-05T05:30:00.000Z",
  order_items: [
    { product_name: "원피스", color: "블랙", size: "M", quantity: 1 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyAdmin.mockResolvedValue({ id: "admin-1", email: "admin@test.com" })
  resolveUserEmail.mockResolvedValue("user@test.com")
})

describe("PATCH /api/admin/orders/[id] — 수동 DELIVERED 회귀", () => {
  it("DELIVERED 전환 시 status/delivered_at/delivered_via='ADMIN' + 배송완료 메일", async () => {
    const captured = { updatePayloads: [] as unknown[] }
    createAdminClient.mockReturnValue(
      makeAdminClient({
        currentOrder: {
          status: "SHIPPING",
          courier: "CJ대한통운",
          tracking_no: "509604734075",
        },
        orderFull: ORDER_FULL,
        captured,
      })
    )

    const res = await PATCH(makeReq({ status: "DELIVERED" }), {
      params: { id: ORDER_ID },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ success: true })

    // 단일 update = markOrderDelivered의 전환 payload
    expect(captured.updatePayloads).toHaveLength(1)
    const payload = captured.updatePayloads[0] as Record<string, unknown>
    expect(payload.status).toBe("DELIVERED")
    expect(payload.delivered_via).toBe("ADMIN")
    expect(typeof payload.delivered_at).toBe("string")
    expect(Number.isNaN(Date.parse(payload.delivered_at as string))).toBe(false)

    // 배송완료 메일 발송(인라인→공유함수 이관분)
    expect(sendShippingDelivered).toHaveBeenCalledTimes(1)
    const mail = sendShippingDelivered.mock.calls[0][0] as Record<string, unknown>
    expect(mail.to).toBe("user@test.com")
    expect(mail.orderNo).toBe("20260605-0001")
    expect(sendShippingStarted).not.toHaveBeenCalled()
  })

  it("이미 DELIVERED(terminal)면 409 — 전환/메일 없음", async () => {
    const captured = { updatePayloads: [] as unknown[] }
    createAdminClient.mockReturnValue(
      makeAdminClient({
        currentOrder: { status: "DELIVERED", courier: "CJ대한통운", tracking_no: "1" },
        orderFull: ORDER_FULL,
        captured,
      })
    )

    const res = await PATCH(makeReq({ status: "DELIVERED" }), {
      params: { id: ORDER_ID },
    })

    expect(res.status).toBe(409)
    expect(captured.updatePayloads).toHaveLength(0)
    expect(sendShippingDelivered).not.toHaveBeenCalled()
  })

  it("SHIPPING 전환 시 shipped_at 기록 + 배송시작 메일(배송완료 메일 아님)", async () => {
    const captured = { updatePayloads: [] as unknown[] }
    createAdminClient.mockReturnValue(
      makeAdminClient({
        currentOrder: {
          status: "PREPARING",
          courier: "CJ대한통운",
          tracking_no: "509604734075",
        },
        orderFull: ORDER_FULL,
        captured,
      })
    )

    const res = await PATCH(makeReq({ status: "SHIPPING" }), {
      params: { id: ORDER_ID },
    })

    expect(res.status).toBe(200)
    expect(captured.updatePayloads).toHaveLength(1)
    const payload = captured.updatePayloads[0] as Record<string, unknown>
    expect(payload.status).toBe("SHIPPING")
    expect(typeof payload.shipped_at).toBe("string")

    expect(sendShippingStarted).toHaveBeenCalledTimes(1)
    expect(sendShippingDelivered).not.toHaveBeenCalled()
  })
})
