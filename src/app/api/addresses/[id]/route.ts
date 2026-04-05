import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const getUser = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export const PUT = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const { supabase, user } = await getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
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

  // 기본배송지로 변경 시 기존 기본배송지 해제
  if (is_default) {
    await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("addresses")
    .update({
      label: label || "배송지",
      recipient,
      phone,
      zipcode,
      address1,
      address2: address2 || null,
      is_default: !!is_default,
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export const DELETE = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const { supabase, user } = await getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  // 삭제 대상이 기본배송지인지 확인
  const { data: target } = await supabase
    .from("addresses")
    .select("is_default")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!target) {
    return NextResponse.json(
      { error: "배송지를 찾을 수 없습니다" },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 기본배송지 삭제 시 다음 배송지를 기본으로
  if (target.is_default) {
    const { data: next } = await supabase
      .from("addresses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (next) {
      await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", next.id)
    }
  }

  return NextResponse.json({ success: true })
}

export const PATCH = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const { supabase, user } = await getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  // 기존 기본배송지 해제
  await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true)

  // 새 기본배송지 설정
  const { data, error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
