import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { ordersLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cancelOrder } from "@/lib/order/cancel-order"
import { sendRefundCompleted } from "@/lib/email/send"
import {
  formatKST,
  getOrderDetailUrl,
  getPaymentMethodLabel,
  getRefundEta,
  resolveUserEmail,
} from "@/lib/email/mappers"

const postHandler = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  // 본인 주문 확인
  const admin = createAdminClient()
  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!order) {
    return NextResponse.json(
      { error: "주문을 찾을 수 없습니다" },
      { status: 404 }
    )
  }

  const result = await cancelOrder(params.id, {
    actor: "USER",
    reason: "CUSTOMER_REQUEST",
  })

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  // 환불 완료 메일 — cancelOrder success 후, fire-and-forget
  // await 금지: cancel 응답 latency를 메일용 DB 조회 + 발송에 잡히지 않도록.
  dispatchRefundEmail(params.id, "USER").catch((err) => {
    Sentry.captureException(err, {
      level: "warning",
      tags: { type: "email", event: "refund_completed_dispatch_failed" },
      extra: { orderId: params.id, actor: "USER" },
    })
  })

  return NextResponse.json({ success: true })
}

// admin cancel route와 동일 로직 (헬퍼 추출 P2 후속).
const dispatchRefundEmail = async (orderId: string, actor: "USER" | "ADMIN") => {
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
      extra: { orderId: orderFull.id, userId: orderFull.user_id, actor },
    })
    return
  }

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
    context: { orderId: orderFull.id, userId: orderFull.user_id, actor },
  })
}

export const POST = withRateLimit(ordersLimiter, postHandler)
