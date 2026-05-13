import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import {
  getAllTopBannersAdmin,
  createTopBannerAdmin,
  type TopBannerInsert,
} from "@/lib/banners"

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const ALLOWED_VARIANTS = ["normal", "urgent"] as const

const getHandler = async () => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const banners = await getAllTopBannersAdmin()
  return NextResponse.json(banners)
}

const postHandler = async (request: NextRequest) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json()
  const {
    emoji,
    message,
    link_url,
    variant,
    bg_color,
    text_color,
    is_active,
    starts_at,
    ends_at,
    sort_order,
  } = body

  // message 필수
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "메시지를 입력하세요" }, { status: 400 })
  }
  if (message.length > 200) {
    return NextResponse.json(
      { error: "메시지는 200자 이내여야 합니다" },
      { status: 400 }
    )
  }

  // emoji
  if (emoji != null && (typeof emoji !== "string" || emoji.length > 8)) {
    return NextResponse.json(
      { error: "이모지는 8자 이내여야 합니다" },
      { status: 400 }
    )
  }

  // link_url
  if (
    link_url != null &&
    (typeof link_url !== "string" || link_url.length > 500)
  ) {
    return NextResponse.json(
      { error: "링크 URL은 500자 이내여야 합니다" },
      { status: 400 }
    )
  }

  // variant
  const variantValue: "normal" | "urgent" = variant ?? "normal"
  if (!ALLOWED_VARIANTS.includes(variantValue)) {
    return NextResponse.json(
      { error: "variant는 normal 또는 urgent만 가능합니다" },
      { status: 400 }
    )
  }

  // 색상 hex
  if (
    bg_color != null &&
    (typeof bg_color !== "string" || !HEX_COLOR_REGEX.test(bg_color))
  ) {
    return NextResponse.json(
      { error: "bg_color는 hex 형식(#RRGGBB)이어야 합니다" },
      { status: 400 }
    )
  }
  if (
    text_color != null &&
    (typeof text_color !== "string" || !HEX_COLOR_REGEX.test(text_color))
  ) {
    return NextResponse.json(
      { error: "text_color는 hex 형식(#RRGGBB)이어야 합니다" },
      { status: 400 }
    )
  }

  // sort_order
  const sortOrderValue: number = sort_order ?? 0
  if (
    !Number.isInteger(sortOrderValue) ||
    sortOrderValue < 0 ||
    sortOrderValue > 9999
  ) {
    return NextResponse.json(
      { error: "sort_order는 0~9999 정수여야 합니다" },
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

  const input: TopBannerInsert = {
    emoji: emoji ?? null,
    message: message.trim(),
    link_url: link_url ?? null,
    variant: variantValue,
    bg_color: bg_color ?? null,
    text_color: text_color ?? null,
    is_active: typeof is_active === "boolean" ? is_active : true,
    starts_at: starts_at ?? null,
    ends_at: ends_at ?? null,
    sort_order: sortOrderValue,
  }

  try {
    const banner = await createTopBannerAdmin(input)
    revalidatePath("/admin/banners")
    revalidatePath("/", "layout")
    return NextResponse.json(banner, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "배너 생성 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withRateLimit(adminLimiter, getHandler)
export const POST = withRateLimit(adminLimiter, postHandler)
