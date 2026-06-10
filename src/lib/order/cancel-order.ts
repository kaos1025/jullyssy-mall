import { createAdminClient } from "@/lib/supabase/admin"
import type { CancellationContext } from "@/lib/order/cancellation"
import { tossCancel } from "@/lib/payment/toss-cancel"

interface CancelResult {
  success: true
}

interface CancelError {
  error: string
  status: number
}

// PAID/PREPARING 주문 취소 — 토스 환불 + 재고/포인트/쿠폰 원복 + status='CANCELLED' 전이.
// PENDING은 cleanupPendingOrder() 경로 사용.
// ctx.actor/reason은 orders 테이블에 함께 저장하여 사용자 마이페이지 사유 노출과 운영 분석에 활용.
export const cancelOrder = async (
  orderId: string,
  ctx: CancellationContext
): Promise<CancelResult | CancelError> => {
  const admin = createAdminClient()

  // 1. 주문 조회
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items:order_items(*)")
    .eq("id", orderId)
    .single()

  if (!order) {
    return { error: "주문을 찾을 수 없습니다", status: 404 }
  }

  // 2. 상태 검증
  if (order.status === "CANCELLED") {
    return { success: true } // 이미 취소됨 (멱등성)
  }

  if (!["PAID", "PREPARING"].includes(order.status)) {
    return {
      error: "배송 중인 주문은 취소할 수 없습니다. 반품 신청을 이용해주세요.",
      status: 400,
    }
  }

  // 3. 토스페이먼츠 결제 취소 (DB 변경 전에 먼저 실행)
  const { data: payment } = await admin
    .from("payments")
    .select("payment_key")
    .eq("order_id", orderId)
    .eq("status", "DONE")
    .single()

  if (payment?.payment_key) {
    // P1-16: 인라인 Toss 호출을 tossCancel primitive로 교체 (전액 — 거동 동일 + 멱등키/검증 인프라 공유).
    const cancelRes = await tossCancel(payment.payment_key, {
      cancelReason: "고객 주문 취소",
    })
    if (!cancelRes.ok) {
      return { error: cancelRes.error, status: 502 }
    }
  }

  // 4. 재고 원복 (토스 성공 후에만)
  for (const item of order.order_items) {
    if (item.product_option_id) {
      await admin.rpc("restore_stock", {
        p_option_id: item.product_option_id,
        p_quantity: item.quantity,
      })
    }
  }

  // 5. 포인트 환불
  if (order.point_used > 0) {
    const { data: profile } = await admin
      .from("profiles")
      .select("point")
      .eq("id", order.user_id)
      .single()

    if (profile) {
      await admin
        .from("profiles")
        .update({ point: profile.point + order.point_used })
        .eq("id", order.user_id)

      await admin.from("point_histories").insert({
        user_id: order.user_id,
        amount: order.point_used,
        reason: "주문 취소 환불",
        order_id: order.id,
      })
    }
  }

  // 6. 쿠폰 원복
  if (order.coupon_id) {
    await admin
      .from("user_coupons")
      .update({ used_at: null, order_id: null })
      .eq("order_id", orderId)
      .eq("coupon_id", order.coupon_id)
  }

  // 7. payments 상태 변경
  await admin
    .from("payments")
    .update({ status: "CANCELLED" })
    .eq("order_id", orderId)
    .eq("status", "DONE")

  // 8. orders 상태 변경 + 취소 메타데이터
  await admin
    .from("orders")
    .update({
      status: "CANCELLED",
      cancellation_actor: ctx.actor,
      cancellation_reason: ctx.reason,
      cancellation_note: ctx.note ?? null,
    })
    .eq("id", orderId)

  return { success: true }
}
