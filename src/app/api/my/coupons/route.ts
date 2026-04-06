import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const GET = async (request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const filter = searchParams.get("filter") || "available"

  const { data, error } = await supabase
    .from("user_coupons")
    .select("*, coupon:coupons(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date()
  const filtered = (data || []).filter((uc) => {
    const coupon = uc.coupon
    if (!coupon) return false

    switch (filter) {
      case "available":
        return (
          !uc.used_at &&
          coupon.is_active &&
          new Date(coupon.starts_at) <= now &&
          (!coupon.expires_at || new Date(coupon.expires_at) > now)
        )
      case "used":
        return !!uc.used_at
      case "expired":
        return (
          !uc.used_at &&
          coupon.expires_at &&
          new Date(coupon.expires_at) <= now
        )
      default:
        return true
    }
  })

  // 사용 가능 쿠폰은 만료 임박순으로 정렬
  if (filter === "available") {
    filtered.sort((a, b) => {
      const aExp = a.coupon?.expires_at ? new Date(a.coupon.expires_at).getTime() : Infinity
      const bExp = b.coupon?.expires_at ? new Date(b.coupon.expires_at).getTime() : Infinity
      return aExp - bExp
    })
  }

  return NextResponse.json(filtered)
}
