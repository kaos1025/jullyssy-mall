import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import {
  getTopBannerByIdAdmin,
  updateTopBannerAdmin,
  deleteTopBannerAdmin,
  type TopBannerUpdate,
} from "@/lib/banners"

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const ALLOWED_VARIANTS = ["normal", "urgent"] as const

const getHandler = async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const banner = await getTopBannerByIdAdmin(params.id)
  if (!banner) {
    return NextResponse.json(
      { error: "배너를 찾을 수 없습니다" },
      { status: 404 }
    )
  }
  return NextResponse.json(banner)
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
  const updateData: TopBannerUpdate = {}

  // emoji (nullable)
  if (body.emoji !== undefined) {
    if (body.emoji !== null && (typeof body.emoji !== "string" || body.emoji.length > 8)) {
      return NextResponse.json(
        { error: "이모지는 8자 이내여야 합니다" },
        { status: 400 }
      )
    }
    updateData.emoji = body.emoji
  }

  // message
  if (body.message !== undefined) {
    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json({ error: "메시지를 입력하세요" }, { status: 400 })
    }
    if (body.message.length > 200) {
      return NextResponse.json(
        { error: "메시지는 200자 이내여야 합니다" },
        { status: 400 }
      )
    }
    updateData.message = body.message.trim()
  }

  // link_url (nullable)
  if (body.link_url !== undefined) {
    if (
      body.link_url !== null &&
      (typeof body.link_url !== "string" || body.link_url.length > 500)
    ) {
      return NextResponse.json(
        { error: "링크 URL은 500자 이내여야 합니다" },
        { status: 400 }
      )
    }
    updateData.link_url = body.link_url
  }

  // variant
  if (body.variant !== undefined) {
    if (!ALLOWED_VARIANTS.includes(body.variant)) {
      return NextResponse.json(
        { error: "variant는 normal 또는 urgent만 가능합니다" },
        { status: 400 }
      )
    }
    updateData.variant = body.variant
  }

  // bg_color (nullable)
  if (body.bg_color !== undefined) {
    if (
      body.bg_color !== null &&
      (typeof body.bg_color !== "string" || !HEX_COLOR_REGEX.test(body.bg_color))
    ) {
      return NextResponse.json(
        { error: "bg_color는 hex 형식(#RRGGBB)이어야 합니다" },
        { status: 400 }
      )
    }
    updateData.bg_color = body.bg_color
  }

  // text_color (nullable)
  if (body.text_color !== undefined) {
    if (
      body.text_color !== null &&
      (typeof body.text_color !== "string" || !HEX_COLOR_REGEX.test(body.text_color))
    ) {
      return NextResponse.json(
        { error: "text_color는 hex 형식(#RRGGBB)이어야 합니다" },
        { status: 400 }
      )
    }
    updateData.text_color = body.text_color
  }

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

  // sort_order
  if (body.sort_order !== undefined) {
    if (
      !Number.isInteger(body.sort_order) ||
      body.sort_order < 0 ||
      body.sort_order > 9999
    ) {
      return NextResponse.json(
        { error: "sort_order는 0~9999 정수여야 합니다" },
        { status: 400 }
      )
    }
    updateData.sort_order = body.sort_order
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "수정할 항목이 없습니다" },
      { status: 400 }
    )
  }

  try {
    const banner = await updateTopBannerAdmin(params.id, updateData)
    revalidatePath("/admin/banners")
    revalidatePath("/admin/banners/[id]", "page")
    revalidatePath("/", "layout")
    return NextResponse.json(banner)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "배너 수정 실패"
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
    await deleteTopBannerAdmin(params.id)
    revalidatePath("/admin/banners")
    revalidatePath("/admin/banners/[id]", "page")
    revalidatePath("/", "layout")
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "배너 삭제 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withRateLimit(adminLimiter, getHandler)
export const PATCH = withRateLimit(adminLimiter, patchHandler)
export const DELETE = withRateLimit(adminLimiter, deleteHandler)
