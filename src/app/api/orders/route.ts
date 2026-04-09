import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const POST = async (request: Request) => {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const body = await request.json()
  const { items, address, coupon_id, point_used, shipping_fee } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "주문 상품이 없습니다" }, { status: 400 })
  }

  const { data, error } = await admin.rpc("create_order_with_items", {
    p_user_id: user.id,
    p_items: items,
    p_address: address,
    p_coupon_id: coupon_id || null,
    p_point_used: point_used || 0,
    p_shipping_fee: shipping_fee || 0,
  })

  if (error) {
    const isClientError =
      error.message.includes("재고가 부족합니다") ||
      error.message.includes("포인트가 부족합니다") ||
      error.message.includes("결제 금액이 올바르지 않습니다")
    return NextResponse.json(
      { error: error.message },
      { status: isClientError ? 400 : 500 }
    )
  }

  return NextResponse.json(data)
}
