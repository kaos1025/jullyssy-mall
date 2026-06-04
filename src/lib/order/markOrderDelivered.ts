import * as Sentry from "@sentry/nextjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendShippingDelivered } from "@/lib/email/send"
import {
  formatKST,
  getOrderDetailUrl,
  resolveUserEmail,
} from "@/lib/email/mappers"
import type { DeliveredVia } from "./delivery"

// 배송완료(SHIPPING→DELIVERED) 전환의 부수효과 SSOT.
// 수동(admin PATCH)과 자동(cron 폴링)이 동일 경로를 타도록 단일화한다 —
// status enum 부수효과(배송완료 메일)를 누락한 채 직접 무인 UPDATE하는 결함 패턴을 차단.
// 완료 주체(delivered_via) 타입은 client/server 공유를 위해 ./delivery에 분리.

interface MarkDeliveredOptions {
  via: DeliveredVia
  /** 자동완료 시 추적 API의 실제 완료시각. 없으면 now. */
  deliveredAt?: Date | null
  /**
   * 전이 직전 status 가드(멱등성/경합). cron은 "SHIPPING" 전달 →
   * 동시 실행/재폴링으로 이미 DELIVERED면 no-op(skipped). 수동 경로는 생략(상위에서 terminal freeze 검증 완료).
   */
  guardStatus?: string
}

export type MarkDeliveredResult =
  | { status: "transitioned" }
  | { status: "skipped" }
  | { status: "error"; error: string }

export const markOrderDelivered = async (
  admin: SupabaseClient,
  orderId: string,
  { via, deliveredAt, guardStatus }: MarkDeliveredOptions
): Promise<MarkDeliveredResult> => {
  const deliveredAtIso = (deliveredAt ?? new Date()).toISOString()

  let update = admin
    .from("orders")
    .update({
      status: "DELIVERED",
      delivered_at: deliveredAtIso,
      delivered_via: via,
    })
    .eq("id", orderId)
  if (guardStatus) update = update.eq("status", guardStatus)

  // .select()로 실제 매칭 row 확인 — 0건이면 이미 전이됨/guard 불일치 → 멱등 no-op.
  const { data, error } = await update.select("id")
  if (error) return { status: "error", error: error.message }
  if (!data || data.length === 0) return { status: "skipped" }

  await sendDeliveredEmail(admin, orderId)
  return { status: "transitioned" }
}

// 배송완료 메일 — 전환 성공 후. 메일 실패가 전환을 되돌리지 않도록 try/catch로 격리.
// (수동/자동 동일 경로. PATCH 라우트의 기존 인라인 블록을 이리로 이관.)
const sendDeliveredEmail = async (
  admin: SupabaseClient,
  orderId: string
): Promise<void> => {
  try {
    const { data: orderFull } = await admin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single()
    if (!orderFull) return

    const userEmail = await resolveUserEmail(orderFull.user_id)
    if (!userEmail) {
      Sentry.captureMessage("Email recipient missing", {
        level: "info",
        tags: { type: "email", event: "shipping_delivered_skip" },
        extra: { orderId: orderFull.id, userId: orderFull.user_id },
      })
      return
    }

    await sendShippingDelivered({
      to: userEmail,
      customerName: orderFull.recipient,
      orderNo: orderFull.order_no,
      deliveredDate: formatKST(orderFull.delivered_at ?? orderFull.updated_at),
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
  } catch (err) {
    Sentry.captureException(err, {
      tags: { type: "email", event: "shipping_delivered_error" },
      extra: { orderId },
    })
  }
}
