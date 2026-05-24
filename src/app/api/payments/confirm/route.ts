import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { paymentsLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { cleanupPendingOrder } from "@/lib/order/cleanup-pending-order"
import { sendOrderConfirmation } from "@/lib/email/send"
import {
  formatKST,
  getOrderDetailUrl,
  getPaymentMethodLabel,
  resolveUserEmail,
} from "@/lib/email/mappers"

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
      await cleanupPendingOrder(admin, orderUuid, "PAYMENT_FAILED", tossData)
      return NextResponse.redirect(
        `${origin}/checkout?error=${tossData.code || "payment_failed"}`
      )
    }

    const paymentMethod = mapPaymentMethod(tossData)

    await admin.from("payments").insert({
      order_id: orderUuid,
      payment_key: paymentKey,
      method: paymentMethod,
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

    // 결제 승인 성공 후 — orders 전체 + order_items 통합 조회 (cart 정리 + 메일 props 양쪽 활용)
    const { data: orderFull } = await admin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderUuid)
      .single()

    if (orderFull?.order_items?.length) {
      const optionIds = orderFull.order_items
        .map((i: { product_option_id: string | null }) => i.product_option_id)
        .filter((id: string | null): id is string => !!id)
      if (optionIds.length) {
        await admin
          .from("cart_items")
          .delete()
          .eq("user_id", orderFull.user_id)
          .in("product_option_id", optionIds)
      }
    }

    // 주문 확정 메일 — DB commit 후, fire-and-forget (결제 응답 차단 금지)
    if (orderFull) {
      const userEmail = await resolveUserEmail(orderFull.user_id)
      if (userEmail) {
        sendOrderConfirmation({
          to: userEmail,
          customerName: orderFull.recipient,
          orderNo: orderFull.order_no,
          orderDate: formatKST(orderFull.created_at),
          items: orderFull.order_items.map(
            (i: {
              product_name: string
              color: string
              size: string
              quantity: number
              price: number
            }) => ({
              productName: i.product_name,
              optionName: `${i.color} / ${i.size}`,
              quantity: i.quantity,
              priceEach: i.price,
            })
          ),
          subtotal: orderFull.total_amount,
          shippingFee: orderFull.shipping_fee,
          discount:
            orderFull.discount_amount > 0 ? orderFull.discount_amount : undefined,
          total: orderFull.paid_amount,
          paymentMethod: getPaymentMethodLabel(paymentMethod),
          shipping: {
            recipient: orderFull.recipient,
            phone: orderFull.recipient_phone,
            postalCode: orderFull.zipcode,
            address: orderFull.address1,
            addressDetail: orderFull.address2 || undefined,
            message: orderFull.delivery_memo || undefined,
          },
          orderDetailUrl: getOrderDetailUrl(orderFull.id),
          context: { orderId: orderFull.id, userId: orderFull.user_id },
        })
      } else {
        Sentry.captureMessage("Email recipient missing", {
          level: "info",
          tags: { type: "email", event: "order_confirmation_skip" },
          extra: { orderId: orderFull.id, userId: orderFull.user_id },
        })
      }
    }

    return NextResponse.redirect(
      `${origin}/order-complete?order_id=${orderUuid}`
    )
  } catch {
    await cleanupPendingOrder(admin, orderUuid, "PAYMENT_FAILED")
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

export const GET = withRateLimit(paymentsLimiter, getHandler)
