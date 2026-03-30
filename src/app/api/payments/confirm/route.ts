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
    // 토스페이먼츠 결제 승인 API 호출
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
      // 결제 실패 시 재고 원복
      await rollbackOrder(admin, orderUuid)
      return NextResponse.redirect(
        `${origin}/checkout?error=${tossData.code || "payment_failed"}`
      )
    }

    // 결제 성공: payments INSERT + 주문 상태 변경
    await admin.from("payments").insert({
      order_id: orderUuid,
      payment_key: paymentKey,
      method: mapPaymentMethod(tossData.method),
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
    await rollbackOrder(admin, orderUuid)
    return NextResponse.redirect(`${origin}/checkout?error=server_error`)
  }
}

const mapPaymentMethod = (method: string) => {
  const map: Record<string, string> = {
    카드: "CARD",
    계좌이체: "TRANSFER",
    가상계좌: "VIRTUAL_ACCOUNT",
    간편결제: "KAKAOPAY",
  }
  return map[method] || "CARD"
}

const rollbackOrder = async (
  admin: ReturnType<typeof createAdminClient>,
  orderId: string
) => {
  // 주문 상품의 재고 원복
  const { data: orderItems } = await admin
    .from("order_items")
    .select("product_option_id, quantity")
    .eq("order_id", orderId)

  if (orderItems) {
    for (const item of orderItems) {
      const { data: option } = await admin
        .from("product_options")
        .select("stock")
        .eq("id", item.product_option_id)
        .single()

      if (option) {
        await admin
          .from("product_options")
          .update({ stock: option.stock + item.quantity })
          .eq("id", item.product_option_id)
      }
    }
  }

  // 주문 삭제
  await admin.from("orders").delete().eq("id", orderId)
}
