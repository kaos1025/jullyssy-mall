import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async (request: NextRequest) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { searchParams } = request.nextUrl
  const isActive = searchParams.get("is_active")

  let query = admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false })

  if (isActive === "true") {
    query = query.eq("is_active", true)
  } else if (isActive === "false") {
    query = query.eq("is_active", false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export const POST = async (request: NextRequest) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await request.json()
  const { code, name, type, value, min_order_price, max_discount, starts_at, expires_at, total_quantity } = body

  // 필수 필드 검증
  if (!code || !name || !type || value == null) {
    return NextResponse.json({ error: "필수 항목을 모두 입력해주세요" }, { status: 400 })
  }

  // code 형식 검증: 대문자+숫자만
  if (!/^[A-Z0-9]+$/.test(code)) {
    return NextResponse.json({ error: "쿠폰 코드는 대문자와 숫자만 사용할 수 있습니다" }, { status: 400 })
  }

  // type 검증
  if (!["FIXED", "PERCENT"].includes(type)) {
    return NextResponse.json({ error: "할인 타입은 FIXED 또는 PERCENT만 가능합니다" }, { status: 400 })
  }

  // PERCENT 범위 검증
  if (type === "PERCENT" && (value < 1 || value > 100)) {
    return NextResponse.json({ error: "할인율은 1~100 사이여야 합니다" }, { status: 400 })
  }

  // code 중복 체크
  const { data: existing } = await admin
    .from("coupons")
    .select("id")
    .eq("code", code)
    .single()

  if (existing) {
    return NextResponse.json({ error: "이미 사용 중인 쿠폰 코드입니다" }, { status: 409 })
  }

  const { data, error } = await admin
    .from("coupons")
    .insert({
      code,
      name,
      type,
      value,
      min_order_price: min_order_price || 0,
      max_discount: max_discount || null,
      starts_at: starts_at || new Date().toISOString(),
      expires_at: expires_at || null,
      total_quantity: total_quantity || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
