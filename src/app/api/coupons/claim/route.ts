import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const POST = async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const admin = createAdminClient()
  const body = await request.json()
  const { code } = body

  if (!code) {
    return NextResponse.json({ error: "쿠폰 코드를 입력해주세요" }, { status: 400 })
  }

  // 쿠폰 조회
  const { data: coupon } = await admin
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single()

  if (!coupon) {
    return NextResponse.json({ error: "존재하지 않는 쿠폰 코드입니다" }, { status: 404 })
  }

  // 유효기간 체크
  const now = new Date()
  if (new Date(coupon.starts_at) > now) {
    return NextResponse.json({ error: "아직 사용할 수 없는 쿠폰입니다" }, { status: 400 })
  }
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) {
    return NextResponse.json({ error: "만료된 쿠폰입니다" }, { status: 400 })
  }

  // 발급 수량 체크
  if (coupon.total_quantity !== null && coupon.issued_count >= coupon.total_quantity) {
    return NextResponse.json({ error: "쿠폰이 모두 소진되었습니다" }, { status: 400 })
  }

  // 중복 발급 체크
  const { data: existing } = await admin
    .from("user_coupons")
    .select("id")
    .eq("user_id", user.id)
    .eq("coupon_id", coupon.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: "이미 보유 중인 쿠폰입니다" }, { status: 409 })
  }

  // 발급
  const { data: inserted, error: insertError } = await admin
    .from("user_coupons")
    .insert({ user_id: user.id, coupon_id: coupon.id })
    .select("id")
    .single()

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message || "발급 실패" }, { status: 500 })
  }

  // issued_count 증가
  await admin
    .from("coupons")
    .update({ issued_count: coupon.issued_count + 1 })
    .eq("id", coupon.id)

  return NextResponse.json({
    success: true,
    coupon_name: coupon.name,
    user_coupon_id: inserted.id,
  })
}
