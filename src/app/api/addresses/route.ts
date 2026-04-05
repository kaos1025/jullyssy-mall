import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const GET = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export const POST = async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  // 최대 5개 제한
  const { count } = await supabase
    .from("addresses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  if (count !== null && count >= 5) {
    return NextResponse.json(
      { error: "배송지는 최대 5개까지 등록할 수 있습니다" },
      { status: 400 }
    )
  }

  const body = await request.json()
  const { label, recipient, phone, zipcode, address1, address2, is_default } =
    body

  if (!recipient || !phone || !zipcode || !address1) {
    return NextResponse.json(
      { error: "필수 항목을 모두 입력해주세요" },
      { status: 400 }
    )
  }

  // 첫 번째 배송지이거나 기본배송지로 설정 시 기존 기본배송지 해제
  const shouldBeDefault = count === 0 || is_default
  if (shouldBeDefault) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      label: label || "배송지",
      recipient,
      phone,
      zipcode,
      address1,
      address2: address2 || null,
      is_default: shouldBeDefault,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
