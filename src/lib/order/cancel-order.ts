import { createAdminClient } from "@/lib/supabase/admin"

interface CancelResult {
  success: true
}

interface CancelError {
  error: string
  status: number
}

export const cancelOrder = async (
  orderId: string
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
    const secretKey = process.env.TOSS_SECRET_KEY || ""
    const basicAuth = Buffer.from(`${secretKey}:`).toString("base64")

    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${payment.payment_key}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancelReason: "고객 주문 취소" }),
      }
    )

    if (!tossRes.ok) {
      const tossError = await tossRes.json()
      return {
        error: tossError.message || "결제 취소에 실패했습니다",
        status: 502,
      }
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

  // 6. 쿠폰 반환 — TODO: Day 6 쿠폰 시스템 구현 시 연동

  // 7. payments 상태 변경
  await admin
    .from("payments")
    .update({ status: "CANCELLED" })
    .eq("order_id", orderId)
    .eq("status", "DONE")

  // 8. orders 상태 변경
  await admin
    .from("orders")
    .update({ status: "CANCELLED" })
    .eq("id", orderId)

  return { success: true }
}
