import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { paymentsLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

const getHandler = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url)
  const paymentKey = searchParams.get("paymentKey")
  const orderId = searchParams.get("orderId")
  const amount = searchParams.get("amount")
  const orderUuid = searchParams.get("order_id")

  if (!paymentKey || !orderId || !amount || !orderUuid) {
    return NextResponse.redirect(`${origin}/checkout?error=invalid_params`)
  }

  const admin = createAdminClient()

  // 토스 confirm 호출 직전 서버측 검증.
  // 토스는 confirm 시점에 amount를 자체 검증하지 않으므로 (가맹점 책임 — Toss v2 SDK 문서 명시),
  // successUrl의 amount 쿼리가 조작되면 그대로 승인된다. 우리 DB의 paid_amount와 비교해 차단.
  const { data: order } = await admin
    .from("orders")
    .select("paid_amount, status, user_id")
    .eq("id", orderUuid)
    .single()

  if (!order) {
    return NextResponse.redirect(`${origin}/checkout?error=order_not_found`)
  }

  // 중복 confirm 방지: 이미 PAID/CANCELLED 등으로 상태 전이된 주문은 재승인 차단.
  if (order.status !== "PENDING") {
    return NextResponse.redirect(`${origin}/checkout?error=order_state_invalid`)
  }

  if (order.paid_amount !== Number(amount)) {
    Sentry.captureMessage("Payment amount mismatch detected", {
      level: "error",
      tags: { security: "amount_mismatch" },
      extra: {
        order_id: orderUuid,
        intended_amount: order.paid_amount,
        client_amount: Number(amount),
        user_id: order.user_id,
        ip: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      },
    })
    return NextResponse.redirect(`${origin}/checkout?error=amount_mismatch`)
  }

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
      secret: (tossData.secret as string | undefined) ?? null,
    })

    await admin
      .from("orders")
      .update({ status: "PAID" })
      .eq("id", orderUuid)

    // 결제 승인 성공 후 장바구니에서 주문 상품 삭제
    const { data: order } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", orderUuid)
      .single()

    if (order) {
      const { data: orderItems } = await admin
        .from("order_items")
        .select("product_option_id")
        .eq("order_id", orderUuid)

      if (orderItems?.length) {
        const optionIds = orderItems.map((i) => i.product_option_id)
        await admin
          .from("cart_items")
          .delete()
          .eq("user_id", order.user_id)
          .in("product_option_id", optionIds)
      }
    }

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

export const GET = withRateLimit(paymentsLimiter, getHandler)
