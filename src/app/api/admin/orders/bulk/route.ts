import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isAdminOrderStatusBulkAllowed,
  TERMINAL_ORDER_STATUSES,
} from "@/lib/order/status-transitions"
import { buildTrackingUrl } from "@/lib/order/tracking-url"
import { sendShippingStarted } from "@/lib/email/send"
import { formatKST, getOrderDetailUrl } from "@/lib/email/mappers"

const patchHandler = async (request: NextRequest) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { ids, status } = await request.json()

  if (!ids?.length || !status) {
    return NextResponse.json({ error: "ids와 status가 필요합니다" }, { status: 400 })
  }

  // bulk CANCELLED는 cancelOrder 플로우(토스 환불/재고/포인트/쿠폰)를 일괄 누락시키므로
  // 화이트리스트로 차단. 개별 취소는 단건 라우트의 CANCELLED 분기로 처리.
  if (!isAdminOrderStatusBulkAllowed(status)) {
    return NextResponse.json(
      { error: "일괄 변경에 허용되지 않은 상태값입니다" },
      { status: 400 }
    )
  }

  // P1-22 terminal freeze — ids 중 하나라도 terminal 주문이면 전체 거부.
  // silent partial update를 피하고 운영자에게 명시적 피드백 제공.
  const { data: targets } = await admin
    .from("orders")
    .select("id, status")
    .in("id", ids)
    .in("status", TERMINAL_ORDER_STATUSES as unknown as string[])

  if (targets && targets.length > 0) {
    return NextResponse.json(
      {
        code: "ORDER_TERMINAL_STATE",
        message: "취소되었거나 배송 완료된 주문은 상태를 변경할 수 없습니다.",
        terminal_ids: targets.map((t) => t.id),
      },
      { status: 409 }
    )
  }

  // SHIPPING bulk 전환 가드 — 모든 ids에 courier + tracking_no 채워져 있어야 함.
  // 빈 송장 메일 회귀 차단 (단건 PATCH의 TRACKING_REQUIRED 가드와 동일 정책).
  if (status === "SHIPPING") {
    const { data: tracking } = await admin
      .from("orders")
      .select("id, courier, tracking_no")
      .in("id", ids)

    const incomplete = (tracking ?? []).filter(
      (o) => !o.courier || !o.tracking_no
    )
    if (incomplete.length > 0) {
      return NextResponse.json(
        {
          code: "TRACKING_REQUIRED",
          error: "SHIPPING 전환 전 모든 주문에 택배사와 송장번호가 필요합니다",
          missing_ids: incomplete.map((o) => o.id),
        },
        { status: 400 }
      )
    }
  }

  const { error } = await admin
    .from("orders")
    .update({ status })
    .in("id", ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // bulk SHIPPING 메일 일괄 발송 — fire-and-forget per order
  if (status === "SHIPPING") {
    const { data: orderRows } = await admin
      .from("orders")
      .select(
        "id, user_id, order_no, recipient, recipient_phone, zipcode, address1, address2, courier, tracking_no, updated_at"
      )
      .in("id", ids)

    if (orderRows && orderRows.length > 0) {
      const userIds = Array.from(new Set(orderRows.map((o) => o.user_id)))
      const { data: profileRows } = await admin
        .from("profiles")
        .select("id, email")
        .in("id", userIds)

      const emailByUserId = new Map(
        (profileRows ?? []).map((p) => [p.id, p.email])
      )

      for (const o of orderRows) {
        const email = emailByUserId.get(o.user_id)
        if (!email) {
          Sentry.captureMessage("Email recipient missing", {
            level: "info",
            tags: { type: "email", event: "shipping_started_skip" },
            extra: { orderId: o.id, userId: o.user_id, source: "bulk" },
          })
          continue
        }
        const trackingUrl = buildTrackingUrl(o.courier, o.tracking_no)
        if (!trackingUrl || !o.courier || !o.tracking_no) continue

        sendShippingStarted({
          to: email,
          customerName: o.recipient,
          orderNo: o.order_no,
          shippedDate: formatKST(o.updated_at),
          courierName: o.courier,
          trackingNumber: o.tracking_no,
          trackingUrl,
          shipping: {
            recipient: o.recipient,
            phone: o.recipient_phone,
            postalCode: o.zipcode,
            address: o.address1,
            addressDetail: o.address2 || undefined,
          },
          orderDetailUrl: getOrderDetailUrl(o.id),
          context: { orderId: o.id, userId: o.user_id, source: "bulk" },
        })
      }
    }
  }

  return NextResponse.json({ success: true })
}

export const PATCH = withRateLimit(adminLimiter, patchHandler)
