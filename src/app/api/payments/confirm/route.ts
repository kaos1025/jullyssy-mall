import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url)
  const paymentKey = searchParams.get("paymentKey")
  const orderId = searchParams.get("orderId")
  const amount = searchParams.get("amount")
  const orderUuid = searchParams.get("order_id")

  if (!paymentKey || !orderId || !amount || !orderUuid) {
    return NextResponse.redirect(`${origin}/checkout?error=invalid_params`)
  }

  const admin = createAdminClient()

  try {
    const secretKey = process.env.TOSS_SECRET_KEY || ""
    const basicAuth = Buffer.from(`${secretKey}:`).toString("base64")

    const tossRes = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: Number(amount),
        }),
      }
    )

    const tossData = await tossRes.json()

    if (!tossRes.ok) {
      await handlePaymentFailure(admin, orderUuid, tossData)
      return NextResponse.redirect(
        `${origin}/checkout?error=${tossData.code || "payment_failed"}`
      )
    }

    await admin.from("payments").insert({
      order_id: orderUuid,
      payment_key: paymentKey,
      method: mapPaymentMethod(tossData),
      amount: Number(amount),
      status: "DONE",
      raw_response: tossData,
      approved_at: tossData.approvedAt,
    })

    await admin
      .from("orders")
      .update({ status: "PAID" })
      .eq("id", orderUuid)

    return NextResponse.redirect(
      `${origin}/order-complete?order_id=${orderUuid}`
    )
  } catch {
    await handlePaymentFailure(admin, orderUuid)
    return NextResponse.redirect(`${origin}/checkout?error=server_error`)
  }
}

const mapPaymentMethod = (tossData: Record<string, unknown>): string => {
  const easyPay = tossData.easyPay as { provider?: string } | undefined
  if (easyPay?.provider) {
    const providerMap: Record<string, string> = {
      카카오페이: "KAKAOPAY",
      네이버페이: "NAVERPAY",
      토스페이: "TOSSPAY",
    }
    return providerMap[easyPay.provider] || "CARD"
  }

  const methodMap: Record<string, string> = {
    카드: "CARD",
    계좌이체: "TRANSFER",
    가상계좌: "VIRTUAL_ACCOUNT",
  }
  return methodMap[tossData.method as string] || "CARD"
}

const handlePaymentFailure = async (
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  failureData?: Record<string, unknown>
) => {
  // 1. 주문 정보 조회
  const { data: order } = await admin
    .from("orders")
    .select("user_id, point_used, paid_amount")
    .eq("id", orderId)
    .single()

  if (!order) return

  // 2. 재고 원복
  const { data: orderItems } = await admin
    .from("order_items")
    .select("product_option_id, quantity")
    .eq("order_id", orderId)

  if (orderItems) {
    for (const item of orderItems) {
      await admin.rpc("restore_stock", {
        p_option_id: item.product_option_id,
        p_quantity: item.quantity,
      })
    }
  }

  // 3. 쿠폰 반환
  await admin
    .from("user_coupons")
    .update({ used_at: null, order_id: null })
    .eq("order_id", orderId)

  // 4. 포인트 환불
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
      reason: "결제실패 환불",
      order_id: orderId,
    })
  }

  // 5. 주문 상태를 CANCELLED로 변경
  await admin
    .from("orders")
    .update({ status: "CANCELLED" })
    .eq("id", orderId)

  // 6. 결제 실패 기록 저장
  await admin.from("payments").insert({
    order_id: orderId,
    amount: order.paid_amount,
    status: "ABORTED",
    raw_response: failureData || null,
  })
}
