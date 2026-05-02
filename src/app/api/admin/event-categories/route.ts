import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getAllEventCategoriesAdminWithCounts,
  createEventCategoryAdmin,
  isValidHexColor,
  type EventCategoryInsert,
} from "@/lib/events"

const verifyAdmin = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())

  if (!adminEmails.includes(user.email?.toLowerCase() || "")) return null
  return user
}

export const GET = async () => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const categories = await getAllEventCategoriesAdminWithCounts()
  return NextResponse.json(categories)
}

export const POST = async (request: NextRequest) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json()
  const {
    name,
    emoji,
    color,
    starts_at,
    ends_at,
    display_order,
    is_active,
  } = body

  // name 필수
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 })
  }
  if (name.trim().length > 50) {
    return NextResponse.json(
      { error: "이름은 50자 이내여야 합니다" },
      { status: 400 }
    )
  }

  // emoji (nullable, 길이 제한)
  if (emoji != null && (typeof emoji !== "string" || emoji.length > 8)) {
    return NextResponse.json(
      { error: "이모지는 8자 이내여야 합니다" },
      { status: 400 }
    )
  }

  // color 필수, hex 형식
  if (typeof color !== "string" || !isValidHexColor(color)) {
    return NextResponse.json(
      { error: "색상은 #RRGGBB 형식이어야 합니다" },
      { status: 400 }
    )
  }

  // display_order
  const displayOrderValue: number = display_order ?? 0
  if (
    !Number.isInteger(displayOrderValue) ||
    displayOrderValue < 0 ||
    displayOrderValue > 9999
  ) {
    return NextResponse.json(
      { error: "display_order는 0~9999 정수여야 합니다" },
      { status: 400 }
    )
  }

  // 기간 검증
  if (starts_at != null && typeof starts_at !== "string") {
    return NextResponse.json({ error: "starts_at 형식 오류" }, { status: 400 })
  }
  if (ends_at != null && typeof ends_at !== "string") {
    return NextResponse.json({ error: "ends_at 형식 오류" }, { status: 400 })
  }
  if (starts_at && ends_at && new Date(starts_at) >= new Date(ends_at)) {
    return NextResponse.json(
      { error: "종료 일시는 시작 일시보다 이후여야 합니다" },
      { status: 400 }
    )
  }

  const input: EventCategoryInsert = {
    name: name.trim(),
    emoji: emoji ?? null,
    color,
    link_url: null,
    starts_at: starts_at ?? null,
    ends_at: ends_at ?? null,
    display_order: displayOrderValue,
    is_active: typeof is_active === "boolean" ? is_active : true,
  }

  try {
    const category = await createEventCategoryAdmin(input)
    return NextResponse.json(category, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "이벤트 카테고리 생성 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
