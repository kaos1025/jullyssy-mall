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
import { sendShippingStarted } from "@/lib/email/send"
import { markOrderDelivered } from "@/lib/order/markOrderDelivered"
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
  // SHIPPING 전환 가드도 같은 분기에서 함께 처리 (RTT 1회 재사용).
  if (body.status !== undefined) {
    const { data: currentOrder } = await admin
      .from("orders")
      .select("status, courier, tracking_no")
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

    // SHIPPING 전환 시 송장 필수 — body 신규 값 또는 DB 기존 값 둘 중 하나라도 있으면 통과.
    // 운영 흐름: 송장 입력(PATCH 1) → 상태 전환(PATCH 2) 분리 패턴 보존 (P1-23 인라인 입력).
    // body에 송장이 없어도 DB에 이미 채워진 상태면 SHIPPING 전환 허용.
    if (body.status === "SHIPPING") {
      const finalCourier = body.courier ?? currentOrder.courier
      const finalTrackingNo = body.tracking_no ?? currentOrder.tracking_no
      if (!finalCourier || !finalTrackingNo) {
        return NextResponse.json(
          {
            code: "TRACKING_REQUIRED",
            error: "배송 시작 전환에는 택배사와 송장번호를 먼저 입력해주세요",
          },
          { status: 400 }
        )
      }
    }
  }

  // body.status를 무검증 update하면 어드민 실수/내부자 위협으로 PAID→RETURNED 등
  // status만 전이되어 cancelOrder를 우회한 결제 환불 누락이 가능 → 화이트리스트 강제.
  // CANCELLED는 화이트리스트에 없어 자동으로 거부 (전용 cancel 라우트로 유도).
  if (body.status !== undefined && !isAdminOrderStatusAllowed(body.status)) {
    return NextResponse.json(
      { error: "허용되지 않은 상태값입니다" },
      { status: 400 }
    )
  }

  const updateData: Record<string, string> = {}
  if (body.courier) updateData.courier = body.courier
  if (body.tracking_no) updateData.tracking_no = body.tracking_no

  // DELIVERED는 부수효과 SSOT(markOrderDelivered) 경유 — status/delivered_at/delivered_via +
  // 배송완료 메일을 일괄 처리한다. 직접 무인 UPDATE로 메일을 누락하던 결함을 차단하고
  // cron 자동완료와 단일 경로를 공유한다(actor='ADMIN').
  if (body.status === "DELIVERED") {
    // 동반된 송장/택배사 변경분이 있으면 먼저 반영.
    if (Object.keys(updateData).length > 0) {
      const { error } = await admin
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
    const result = await markOrderDelivered(admin, orderId, { via: "ADMIN" })
    if (result.status === "error") {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (body.status !== undefined) updateData.status = body.status
  // SHIPPING 전환 시각 기록 — 폴링 윈도우/배송기간 분석 기반(delivered_at과 대칭).
  if (body.status === "SHIPPING") {
    updateData.shipped_at = new Date().toISOString()
  }

  const { error } = await admin
    .from("orders")
    .update(updateData)
    .eq("id", orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 배송 시작 메일 — UPDATE 성공 후, fire-and-forget.
  // (배송완료 메일은 markOrderDelivered로 이관 — 수동/자동 단일화.)
  if (body.status === "SHIPPING") {
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
          tags: { type: "email", event: "shipping_started_skip" },
          extra: { orderId: orderFull.id, userId: orderFull.user_id },
        })
      } else {
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
      }
    }
  }

  return NextResponse.json({ success: true })
}

export const PATCH = withRateLimit(adminLimiter, patchHandler)
