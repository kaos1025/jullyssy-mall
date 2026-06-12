import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { validateImageFile } from "@/lib/image-upload-validation"
import {
  getAllHeroBannersAdmin,
  createHeroBannerAdmin,
  uploadHeroBannerImage,
  type HeroBannerInsert,
} from "@/lib/hero-banners"

const MAX_TEXT = 200
const MAX_LINK = 500

const getHandler = async () => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const banners = await getAllHeroBannersAdmin()
  return NextResponse.json(banners)
}

const postHandler = async (request: NextRequest) => {
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

  const { title, subtitle, cta_text, cta_link, is_active, starts_at, ends_at, sort_order } =
    payload

  // 텍스트 길이 검증
  for (const [key, val, max] of [
    ["title", title, MAX_TEXT],
    ["subtitle", subtitle, MAX_TEXT],
    ["cta_text", cta_text, MAX_TEXT],
    ["cta_link", cta_link, MAX_LINK],
  ] as const) {
    if (val != null && (typeof val !== "string" || val.length > max)) {
      return NextResponse.json(
        { error: `${key}는 ${max}자 이내 문자열이어야 합니다` },
        { status: 400 }
      )
    }
  }

  // sort_order
  const sortOrderValue = typeof sort_order === "number" ? sort_order : 0
  if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0 || sortOrderValue > 9999) {
    return NextResponse.json(
      { error: "sort_order는 0~9999 정수여야 합니다" },
      { status: 400 }
    )
  }

  // 노출 기간
  if (starts_at != null && typeof starts_at !== "string") {
    return NextResponse.json({ error: "starts_at 형식 오류" }, { status: 400 })
  }
  if (ends_at != null && typeof ends_at !== "string") {
    return NextResponse.json({ error: "ends_at 형식 오류" }, { status: 400 })
  }
  if (starts_at && ends_at && new Date(starts_at as string) >= new Date(ends_at as string)) {
    return NextResponse.json(
      { error: "종료 일시는 시작 일시보다 이후여야 합니다" },
      { status: 400 }
    )
  }

  // 이미지 필수 (생성 시 PC/모바일 둘 다)
  const imagePc = formData.get("image_pc")
  const imageMobile = formData.get("image_mobile")
  if (!(imagePc instanceof File) || imagePc.size === 0) {
    return NextResponse.json({ error: "PC 이미지를 업로드하세요" }, { status: 400 })
  }
  if (!(imageMobile instanceof File) || imageMobile.size === 0) {
    return NextResponse.json({ error: "모바일 이미지를 업로드하세요" }, { status: 400 })
  }

  // 이미지 검증 (비이미지 MIME / 8MB 초과 = 클라이언트 입력 오류 → 400. 상품 업로드 경로와 동일 패턴)
  for (const [file, label] of [
    [imagePc, "PC"],
    [imageMobile, "모바일"],
  ] as const) {
    const validation = validateImageFile(file)
    if (!validation.ok) {
      return NextResponse.json({ error: `${label} ${validation.message}` }, { status: 400 })
    }
  }

  try {
    const [image_url_pc, image_url_mobile] = await Promise.all([
      uploadHeroBannerImage(imagePc, "pc"),
      uploadHeroBannerImage(imageMobile, "mobile"),
    ])

    const input: HeroBannerInsert = {
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      subtitle: typeof subtitle === "string" && subtitle.trim() ? subtitle.trim() : null,
      cta_text: typeof cta_text === "string" && cta_text.trim() ? cta_text.trim() : null,
      cta_link: typeof cta_link === "string" && cta_link.trim() ? cta_link.trim() : null,
      image_url_pc,
      image_url_mobile,
      is_active: typeof is_active === "boolean" ? is_active : true,
      starts_at: (starts_at as string) || null,
      ends_at: (ends_at as string) || null,
      sort_order: sortOrderValue,
    }

    const banner = await createHeroBannerAdmin(input)
    revalidateTag("hero-banners")
    revalidatePath("/admin/hero-banners")
    revalidatePath("/", "layout")
    return NextResponse.json(banner, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "배너 생성 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withRateLimit(adminLimiter, getHandler)
export const POST = withRateLimit(adminLimiter, postHandler)
