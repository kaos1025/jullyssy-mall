import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { cancelOrder } from "@/lib/order/cancel-order"
import { isAdminCancelReason } from "@/lib/order/cancellation"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRefundCompleted } from "@/lib/email/send"
import {
  formatKST,
  getOrderDetailUrl,
  getPaymentMethodLabel,
  getRefundEta,
  resolveUserEmail,
} from "@/lib/email/mappers"

// 어드민 취소 전용 라우트 — 기존 PATCH /api/admin/orders/[id] CANCELLED 분기에서 분리.
// 사유(ADMIN_CANCEL_REASONS) 필수, note 선택. cancelOrder()에 actor='ADMIN' 전달.
const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { reason, note } = body as { reason?: unknown; note?: unknown }

  if (!isAdminCancelReason(reason)) {
    return NextResponse.json(
      { error: "유효하지 않은 취소 사유입니다" },
      { status: 400 }
    )
  }

  const result = await cancelOrder(params.id, {
    actor: "ADMIN",
    reason,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  })

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  // 환불 완료 메일 — cancelOrder success 후, fire-and-forget
  // (lib는 도메인 로직 전담, 메일 부수효과는 라우트 책임)
  // await 금지: cancel 응답 latency를 메일용 DB 조회 + 발송에 잡히지 않도록.
  dispatchRefundEmail(params.id).catch((err) => {
    Sentry.captureException(err, {
      level: "warning",
      tags: { type: "email", event: "refund_completed_dispatch_failed" },
      extra: { orderId: params.id, actor: "ADMIN" },
    })
  })

  return NextResponse.json({ success: true })
}

// 사용자 cancel route(`/api/orders/[id]/cancel`)와 동일 로직.
// 헬퍼 추출(P2 후속) 전까지는 명시적 복제 유지.
const dispatchRefundEmail = async (orderId: string) => {
  const admin = createAdminClient()
  const { data: orderFull } = await admin
    .from("orders")
    .select("*, order_items(*), payments(method)")
    .eq("id", orderId)
    .single()

  if (!orderFull) return

  const userEmail = await resolveUserEmail(orderFull.user_id)
  if (!userEmail) {
    Sentry.captureMessage("Email recipient missing", {
      level: "info",
      tags: { type: "email", event: "refund_completed_skip" },
      extra: { orderId: orderFull.id, userId: orderFull.user_id },
    })
    return
  }

  // payments는 보통 1행 (DONE → CANCELLED). 다중 시 첫 행의 method 사용.
  const paymentMethod = Array.isArray(orderFull.payments)
    ? orderFull.payments[0]?.method
    : (orderFull.payments as { method?: string } | null)?.method

  sendRefundCompleted({
    to: userEmail,
    customerName: orderFull.recipient,
    orderNo: orderFull.order_no,
    refundedDate: formatKST(orderFull.updated_at),
    refundAmount: orderFull.paid_amount,
    paymentMethod: getPaymentMethodLabel(paymentMethod),
    refundEta: getRefundEta(paymentMethod),
    items: (orderFull.order_items ?? []).map(
      (i: {
        product_name: string
        color: string
        size: string
        quantity: number
      }) => ({
        productName: i.product_name,
        optionName: `${i.color} / ${i.size}`,
        quantity: i.quantity,
      })
    ),
    orderDetailUrl: getOrderDetailUrl(orderFull.id),
    context: { orderId: orderFull.id, userId: orderFull.user_id, actor: "ADMIN" },
  })
}

export const POST = withRateLimit(adminLimiter, postHandler)
