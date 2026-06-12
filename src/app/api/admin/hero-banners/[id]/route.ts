import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { validateImageFile } from "@/lib/image-upload-validation"
import {
  getHeroBannerByIdAdmin,
  updateHeroBannerAdmin,
  deleteHeroBannerAdmin,
  uploadHeroBannerImage,
  type HeroBannerUpdate,
} from "@/lib/hero-banners"

const MAX_TEXT = 200
const MAX_LINK = 500

const getHandler = async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const banner = await getHeroBannerByIdAdmin(params.id)
  if (!banner) {
    return NextResponse.json({ error: "배너를 찾을 수 없습니다" }, { status: 404 })
  }
  return NextResponse.json(banner)
}

// 텍스트 필드 정규화: undefined면 skip 신호(null 반환 X), 검증 실패면 에러 문자열
const normalizeText = (
  value: unknown,
  max: number,
  label: string
): { skip: true } | { value: string | null } | { error: string } => {
  if (value === undefined) return { skip: true }
  if (value === null) return { value: null }
  if (typeof value !== "string" || value.length > max) {
    return { error: `${label}는 ${max}자 이내여야 합니다` }
  }
  return { value: value.trim() || null }
}

const patchHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "form 데이터 파싱 실패" }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse((formData.get("payload") as string) || "{}")
  } catch {
    return NextResponse.json({ error: "payload JSON 파싱 실패" }, { status: 400 })
  }

  const updateData: HeroBannerUpdate = {}

  // 텍스트 필드 (부분, nullable)
  const titleR = normalizeText(payload.title, MAX_TEXT, "title")
  if ("error" in titleR) return NextResponse.json({ error: titleR.error }, { status: 400 })
  if ("value" in titleR) updateData.title = titleR.value

  const subtitleR = normalizeText(payload.subtitle, MAX_TEXT, "subtitle")
  if ("error" in subtitleR) return NextResponse.json({ error: subtitleR.error }, { status: 400 })
  if ("value" in subtitleR) updateData.subtitle = subtitleR.value

  const ctaTextR = normalizeText(payload.cta_text, MAX_TEXT, "cta_text")
  if ("error" in ctaTextR) return NextResponse.json({ error: ctaTextR.error }, { status: 400 })
  if ("value" in ctaTextR) updateData.cta_text = ctaTextR.value

  const ctaLinkR = normalizeText(payload.cta_link, MAX_LINK, "cta_link")
  if ("error" in ctaLinkR) return NextResponse.json({ error: ctaLinkR.error }, { status: 400 })
  if ("value" in ctaLinkR) updateData.cta_link = ctaLinkR.value

  // is_active
  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active는 boolean이어야 합니다" }, { status: 400 })
    }
    updateData.is_active = payload.is_active
  }

  // 노출 기간
  if (payload.starts_at !== undefined) {
    if (payload.starts_at !== null && typeof payload.starts_at !== "string") {
      return NextResponse.json({ error: "starts_at 형식 오류" }, { status: 400 })
    }
    updateData.starts_at = (payload.starts_at as string) || null
  }
  if (payload.ends_at !== undefined) {
    if (payload.ends_at !== null && typeof payload.ends_at !== "string") {
      return NextResponse.json({ error: "ends_at 형식 오류" }, { status: 400 })
    }
    updateData.ends_at = (payload.ends_at as string) || null
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
  if (payload.sort_order !== undefined) {
    const s = payload.sort_order
    if (typeof s !== "number" || !Number.isInteger(s) || s < 0 || s > 9999) {
      return NextResponse.json(
        { error: "sort_order는 0~9999 정수여야 합니다" },
        { status: 400 }
      )
    }
    updateData.sort_order = s
  }

  try {
    // 이미지 교체 (선택 — File 있을 때만 새로 업로드, NOT NULL 컬럼이라 빈 값 미할당)
    const imagePc = formData.get("image_pc")
    if (imagePc instanceof File && imagePc.size > 0) {
      const v = validateImageFile(imagePc)
      if (!v.ok) return NextResponse.json({ error: `PC ${v.message}` }, { status: 400 })
      updateData.image_url_pc = await uploadHeroBannerImage(imagePc, "pc")
    }
    const imageMobile = formData.get("image_mobile")
    if (imageMobile instanceof File && imageMobile.size > 0) {
      const v = validateImageFile(imageMobile)
      if (!v.ok) return NextResponse.json({ error: `모바일 ${v.message}` }, { status: 400 })
      updateData.image_url_mobile = await uploadHeroBannerImage(imageMobile, "mobile")
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 항목이 없습니다" }, { status: 400 })
    }

    const banner = await updateHeroBannerAdmin(params.id, updateData)
    revalidateTag("hero-banners")
    revalidatePath("/admin/hero-banners")
    revalidatePath(`/admin/hero-banners/${params.id}`)
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
    await deleteHeroBannerAdmin(params.id)
    revalidateTag("hero-banners")
    revalidatePath("/admin/hero-banners")
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
