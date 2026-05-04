import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { createAdminClient } from "@/lib/supabase/admin"

export const POST = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await request.json()
  const couponId = params.id

  // user_id 또는 user_ids 지원
  const userIds: string[] = body.user_ids || (body.user_id ? [body.user_id] : [])

  if (userIds.length === 0) {
    return NextResponse.json({ error: "발급 대상 유저를 지정해주세요" }, { status: 400 })
  }

  // 쿠폰 존재 및 수량 체크
  const { data: coupon } = await admin
    .from("coupons")
    .select("*")
    .eq("id", couponId)
    .single()

  if (!coupon) {
    return NextResponse.json({ error: "쿠폰을 찾을 수 없습니다" }, { status: 404 })
  }

  if (!coupon.is_active) {
    return NextResponse.json({ error: "비활성화된 쿠폰입니다" }, { status: 400 })
  }

  if (coupon.total_quantity !== null && coupon.issued_count + userIds.length > coupon.total_quantity) {
    return NextResponse.json({
      error: `발급 가능 수량을 초과합니다 (잔여: ${coupon.total_quantity - coupon.issued_count}장)`,
    }, { status: 400 })
  }

  // 중복 발급 체크
  const { data: existing } = await admin
    .from("user_coupons")
    .select("user_id")
    .eq("coupon_id", couponId)
    .in("user_id", userIds)

  const alreadyIssued = new Set((existing || []).map((e) => e.user_id))
  const newUserIds = userIds.filter((id) => !alreadyIssued.has(id))

  if (newUserIds.length === 0) {
    return NextResponse.json({ error: "이미 발급된 유저입니다" }, { status: 409 })
  }

  // 발급
  const inserts = newUserIds.map((userId) => ({
    user_id: userId,
    coupon_id: couponId,
  }))

  const { error: insertError } = await admin
    .from("user_coupons")
    .insert(inserts)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // issued_count 증가
  await admin
    .from("coupons")
    .update({ issued_count: coupon.issued_count + newUserIds.length })
    .eq("id", couponId)

  return NextResponse.json({
    success: true,
    issued: newUserIds.length,
    skipped: alreadyIssued.size,
  })
}
