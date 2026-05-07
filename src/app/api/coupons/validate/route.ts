import { NextRequest, NextResponse } from "next/server"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { couponsLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const postHandler = async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const admin = createAdminClient()
  const body = await request.json()
  const { coupon_id, order_total_price } = body

  if (!coupon_id || order_total_price == null) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: "필수 항목이 누락되었습니다",
    })
  }

  // user_coupon + coupon 조회 (coupon_id는 user_coupons.id)
  const { data: userCoupon } = await admin
    .from("user_coupons")
    .select("*, coupon:coupons(*)")
    .eq("id", coupon_id)
    .eq("user_id", user.id)
    .single()

  if (!userCoupon || !userCoupon.coupon) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: "보유하지 않은 쿠폰입니다",
    })
  }

  const coupon = userCoupon.coupon

  // 사용 여부 체크
  if (userCoupon.used_at) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: "이미 사용된 쿠폰입니다",
    })
  }

  // 활성 상태 체크
  if (!coupon.is_active) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: "비활성화된 쿠폰입니다",
    })
  }

  // 유효기간 체크
  const now = new Date()
  if (new Date(coupon.starts_at) > now) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: "아직 사용할 수 없는 쿠폰입니다",
    })
  }
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: "만료된 쿠폰입니다",
    })
  }

  // 최소 주문금액 체크
  if (coupon.min_order_price > 0 && order_total_price < coupon.min_order_price) {
    return NextResponse.json({
      valid: false,
      discount_amount: 0,
      message: `최소 주문금액 ${coupon.min_order_price.toLocaleString()}원 이상이어야 합니다`,
    })
  }

  // 할인 금액 계산
  let discount_amount: number
  if (coupon.type === "FIXED") {
    discount_amount = coupon.value
  } else {
    discount_amount = Math.floor(order_total_price * coupon.value / 100)
    if (coupon.max_discount !== null) {
      discount_amount = Math.min(discount_amount, coupon.max_discount)
    }
  }

  // 주문금액 초과 방지
  discount_amount = Math.min(discount_amount, order_total_price)

  return NextResponse.json({
    valid: true,
    discount_amount,
    message: `${coupon.name} 적용: ${discount_amount.toLocaleString()}원 할인`,
  })
}

export const POST = withRateLimit(couponsLimiter, postHandler)
