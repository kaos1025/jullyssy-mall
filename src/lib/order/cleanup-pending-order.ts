import type { createAdminClient } from "@/lib/supabase/admin"
import type {
  CancellationActor,
  CancellationReason,
} from "@/lib/order/cancellation"

// PENDING 주문 cleanup — 결제 confirm 단계로 진입하지 못한 주문을 정리한다.
// cancelOrder()는 PAID/PREPARING만 받고 토스 환불을 동반하지만,
// PENDING은 결제 자체가 미승인 상태라 토스 호출 없이 자원 원복만 수행한다.
// 호출 진입점: (1) 결제 confirm 실패 (2) 사용자 결제창 취소 (3) 자동 TTL 만료(cron)

// 본 함수 호출 경로별 reason 매핑 — orders.cancellation_reason CHECK constraint와 정합.
export type CleanupReason = "USER_CANCEL" | "AUTO_EXPIRED" | "PAYMENT_FAILED"

interface CleanupResult {
  success: true
}

interface CleanupError {
  error: string
  status: number
}

const REASON_LABEL: Record<CleanupReason, string> = {
  USER_CANCEL: "주문 취소 환불",
  AUTO_EXPIRED: "주문 자동 만료 환불",
  PAYMENT_FAILED: "결제실패 환불",
}

// CleanupReason → orders 컬럼에 저장할 (actor, reason) 매핑.
// USER_CANCEL은 사용자가 결제창을 직접 닫은 케이스 → CUSTOMER_REQUEST(고객 요청).
// AUTO_EXPIRED는 cron(SYSTEM)이지만 본 라우트 호출 시는 클라이언트 best-effort 회수 — 동일.
// PAYMENT_FAILED는 confirm 호출 실패 → SYSTEM/PAYMENT_FAILURE.
const REASON_TO_METADATA: Record<
  CleanupReason,
  { actor: CancellationActor; reason: CancellationReason }
> = {
  USER_CANCEL: { actor: "USER", reason: "CUSTOMER_REQUEST" },
  AUTO_EXPIRED: { actor: "SYSTEM", reason: "AUTO_EXPIRED" },
  PAYMENT_FAILED: { actor: "SYSTEM", reason: "PAYMENT_FAILURE" },
}

export const cleanupPendingOrder = async (
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  reason: CleanupReason,
  failureData?: Record<string, unknown>
): Promise<CleanupResult | CleanupError> => {
  const { data: order } = await admin
    .from("orders")
    .select("user_id, point_used, paid_amount, status, coupon_id")
    .eq("id", orderId)
    .single()

  if (!order) {
    return { error: "주문을 찾을 수 없습니다", status: 404 }
  }

  // 멱등성 — 이미 CANCELLED는 재진입 허용 (cron + 클라 동시 호출 대비)
  if (order.status === "CANCELLED") {
    return { success: true }
  }

  // PENDING만 처리 — PAID 이상은 cancelOrder() 경로 사용해야 함
  if (order.status !== "PENDING") {
    return { error: "PENDING 상태 주문만 정리할 수 있습니다", status: 400 }
  }

  // 1. 재고 원복
  const { data: orderItems } = await admin
    .from("order_items")
    .select("product_option_id, quantity")
    .eq("order_id", orderId)

  if (orderItems) {
    for (const item of orderItems) {
      if (item.product_option_id) {
        await admin.rpc("restore_stock", {
          p_option_id: item.product_option_id,
          p_quantity: item.quantity,
        })
      }
    }
  }

  // 2. 쿠폰 원복
  if (order.coupon_id) {
    await admin
      .from("user_coupons")
      .update({ used_at: null, order_id: null })
      .eq("order_id", orderId)
  }

  // 3. 포인트 환불
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
    }

    await admin.from("point_histories").insert({
      user_id: order.user_id,
      amount: order.point_used,
      reason: REASON_LABEL[reason],
      order_id: orderId,
    })
  }

  // 4. orders 상태 전이 + 취소 메타데이터
  const metadata = REASON_TO_METADATA[reason]
  await admin
    .from("orders")
    .update({
      status: "CANCELLED",
      cancellation_actor: metadata.actor,
      cancellation_reason: metadata.reason,
    })
    .eq("id", orderId)

  // 5. 결제 실패만 ABORTED 기록 (USER_CANCEL/AUTO_EXPIRED는 토스 시도 자체 없음)
  if (reason === "PAYMENT_FAILED") {
    await admin.from("payments").insert({
      order_id: orderId,
      amount: order.paid_amount,
      status: "ABORTED",
      raw_response: failureData || null,
    })
  }

  return { success: true }
}
