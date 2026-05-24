import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isAdminOrderStatusAllowed,
  isTerminalOrderStatus,
} from "@/lib/order/status-transitions"
import { buildTrackingUrl } from "@/lib/order/tracking-url"
import {
  sendShippingDelivered,
  sendShippingStarted,
} from "@/lib/email/send"
import {
  formatKST,
  getOrderDetailUrl,
  resolveUserEmail,
} from "@/lib/email/mappers"

// 취소는 POST /api/admin/orders/[id]/cancel 전용 — 사유(reason) 입력 강제.
// PATCH는 배송 운영 상태 전이 + 송장 입력만 처리한다.
const patchHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await request.json()
  const orderId = params.id

  // P1-22 terminal freeze — status 변경 시 현재 상태가 terminal(CANCELLED/DELIVERED)이면 거부.
  // 송장/courier만 단독으로 보내는 경우는 통과 (배송 완료 후 송장 정정 등 운영 케이스 보존).
  if (body.status !== undefined) {
    const { data: currentOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single()

    if (!currentOrder) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다" },
        { status: 404 }
      )
    }

    if (isTerminalOrderStatus(currentOrder.status)) {
      return NextResponse.json(
        {
          code: "ORDER_TERMINAL_STATE",
          message: "취소되었거나 배송 완료된 주문은 상태를 변경할 수 없습니다.",
        },
        { status: 409 }
      )
    }
  }

  // body.status를 무검증 update하면 어드민 실수/내부자 위협으로 PAID→RETURNED 등
  // status만 전이되어 cancelOrder를 우회한 결제 환불 누락이 가능 → 화이트리스트 강제.
  // CANCELLED는 화이트리스트에 없어 자동으로 거부 (전용 cancel 라우트로 유도).
  const updateData: Record<string, string> = {}

  if (body.status !== undefined) {
    if (!isAdminOrderStatusAllowed(body.status)) {
      return NextResponse.json(
        { error: "허용되지 않은 상태값입니다" },
        { status: 400 }
      )
    }
    updateData.status = body.status
  }
  if (body.courier) updateData.courier = body.courier
  if (body.tracking_no) updateData.tracking_no = body.tracking_no

  // SHIPPING 전환 시 courier + tracking_no 필수 — body로 함께 입력하는 운영 흐름 강제.
  // 빈 송장으로 발송된 메일이 사용자에게 도달하는 회귀 차단 (Phase 3 가드).
  if (body.status === "SHIPPING") {
    if (!body.courier || !body.tracking_no) {
      return NextResponse.json(
        {
          code: "TRACKING_REQUIRED",
          error: "배송 시작 전환에는 택배사와 송장번호가 모두 필요합니다",
        },
        { status: 400 }
      )
    }
  }

  const { error } = await admin
    .from("orders")
    .update(updateData)
    .eq("id", orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 배송 시작/완료 메일 — UPDATE 성공 후, fire-and-forget
  if (body.status === "SHIPPING" || body.status === "DELIVERED") {
    const { data: orderFull } = await admin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single()

    if (orderFull) {
      const userEmail = await resolveUserEmail(orderFull.user_id)
      if (!userEmail) {
        Sentry.captureMessage("Email recipient missing", {
          level: "info",
          tags: {
            type: "email",
            event:
              body.status === "SHIPPING"
                ? "shipping_started_skip"
                : "shipping_delivered_skip",
          },
          extra: { orderId: orderFull.id, userId: orderFull.user_id },
        })
      } else if (body.status === "SHIPPING") {
        const trackingUrl = buildTrackingUrl(
          orderFull.courier,
          orderFull.tracking_no
        )
        if (trackingUrl && orderFull.courier && orderFull.tracking_no) {
          sendShippingStarted({
            to: userEmail,
            customerName: orderFull.recipient,
            orderNo: orderFull.order_no,
            shippedDate: formatKST(orderFull.updated_at),
            courierName: orderFull.courier,
            trackingNumber: orderFull.tracking_no,
            trackingUrl,
            shipping: {
              recipient: orderFull.recipient,
              phone: orderFull.recipient_phone,
              postalCode: orderFull.zipcode,
              address: orderFull.address1,
              addressDetail: orderFull.address2 || undefined,
            },
            orderDetailUrl: getOrderDetailUrl(orderFull.id),
            context: { orderId: orderFull.id, userId: orderFull.user_id },
          })
        }
      } else {
        sendShippingDelivered({
          to: userEmail,
          customerName: orderFull.recipient,
          orderNo: orderFull.order_no,
          deliveredDate: formatKST(orderFull.updated_at),
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
          context: { orderId: orderFull.id, userId: orderFull.user_id },
        })
      }
    }
  }

  return NextResponse.json({ success: true })
}

export const PATCH = withRateLimit(adminLimiter, patchHandler)
