import { NextResponse } from "next/server"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { ordersLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { SHIPPING_CONFIG } from "@/constants/shipping"

const postHandler = async (request: Request) => {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const body = await request.json()
  // shipping_fee는 더 이상 클라에서 받지 않음 — RPC가 SHIPPING_CONFIG와
  // products.free_shipping 기준으로 서버측 재계산 (Track 2 보안 fix).
  const { items, address, coupon_id, point_used } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "주문 상품이 없습니다" }, { status: 400 })
  }

  const { data, error } = await admin.rpc("create_order_with_items", {
    p_user_id: user.id,
    p_items: items,
    p_address: address,
    p_coupon_id: coupon_id || null,
    p_point_used: point_used || 0,
    p_free_shipping_threshold: SHIPPING_CONFIG.freeShippingThreshold,
    p_standard_shipping_fee: SHIPPING_CONFIG.baseFee,
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

export const POST = withRateLimit(ordersLimiter, postHandler)
