import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import {
  getEventCategoryByIdAdmin,
  updateEventCategoryAdmin,
  deleteEventCategoryAdmin,
  isValidHexColor,
  type EventCategoryUpdate,
} from "@/lib/events"

const getHandler = async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const category = await getEventCategoryByIdAdmin(params.id)
  if (!category) {
    return NextResponse.json(
      { error: "이벤트 카테고리를 찾을 수 없습니다" },
      { status: 404 }
    )
  }
  return NextResponse.json(category)
}

const patchHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json()
  const updateData: EventCategoryUpdate = {}

  // name (NOT NULL)
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 })
    }
    if (body.name.trim().length > 50) {
      return NextResponse.json(
        { error: "이름은 50자 이내여야 합니다" },
        { status: 400 }
      )
    }
    updateData.name = body.name.trim()
  }

  // emoji (nullable)
  if (body.emoji !== undefined) {
    if (
      body.emoji !== null &&
      (typeof body.emoji !== "string" || body.emoji.length > 8)
    ) {
      return NextResponse.json(
        { error: "이모지는 8자 이내여야 합니다" },
        { status: 400 }
      )
    }
    updateData.emoji = body.emoji
  }

  // color (NOT NULL)
  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !isValidHexColor(body.color)) {
      return NextResponse.json(
        { error: "색상은 #RRGGBB 형식이어야 합니다" },
        { status: 400 }
      )
    }
    updateData.color = body.color
  }

  // link_url은 PROMO-3에서 사용하지 않음 — body에 들어와도 무시 (NULLABLE 컬럼은 P2 재활용 대비 유지)

  // is_active
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active는 boolean이어야 합니다" },
        { status: 400 }
      )
    }
    updateData.is_active = body.is_active
  }

  // starts_at / ends_at (nullable string)
  if (body.starts_at !== undefined) {
    if (body.starts_at !== null && typeof body.starts_at !== "string") {
      return NextResponse.json({ error: "starts_at 형식 오류" }, { status: 400 })
    }
    updateData.starts_at = body.starts_at
  }
  if (body.ends_at !== undefined) {
    if (body.ends_at !== null && typeof body.ends_at !== "string") {
      return NextResponse.json({ error: "ends_at 형식 오류" }, { status: 400 })
    }
    updateData.ends_at = body.ends_at
  }
  // 둘 다 입력된 경우에만 비교 (한쪽만 입력 시 운영자 책임 — banners 동일)
  if (
    updateData.starts_at &&
    updateData.ends_at &&
    new Date(updateData.starts_at) >= new Date(updateData.ends_at)
  ) {
    return NextResponse.json(
      { error: "종료 일시는 시작 일시보다 이후여야 합니다" },
      { status: 400 }
    )
  }

  // display_order
  if (body.display_order !== undefined) {
    if (
      !Number.isInteger(body.display_order) ||
      body.display_order < 0 ||
      body.display_order > 9999
    ) {
      return NextResponse.json(
        { error: "display_order는 0~9999 정수여야 합니다" },
        { status: 400 }
      )
    }
    updateData.display_order = body.display_order
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "수정할 항목이 없습니다" },
      { status: 400 }
    )
  }

  try {
    const category = await updateEventCategoryAdmin(params.id, updateData)
    return NextResponse.json(category)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "이벤트 카테고리 수정 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const deleteHandler = async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  try {
    await deleteEventCategoryAdmin(params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "이벤트 카테고리 삭제 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withRateLimit(adminLimiter, getHandler)
export const PATCH = withRateLimit(adminLimiter, patchHandler)
export const DELETE = withRateLimit(adminLimiter, deleteHandler)
