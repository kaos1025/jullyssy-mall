import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateImageFile } from "@/lib/image-upload-validation"
import type { Database } from "@/types/supabase"

export type HeroBanner = Database["public"]["Tables"]["hero_banners"]["Row"]
export type HeroBannerInsert = Database["public"]["Tables"]["hero_banners"]["Insert"]
export type HeroBannerUpdate = Database["public"]["Tables"]["hero_banners"]["Update"]

// =============================================
// 공개용 (홈 렌더 — 캐시 격리)
// =============================================
// lib/products.ts 패턴: createAdminClient(RLS 우회) + unstable_cache(tag 'hero-banners').
// 홈 진입 prefetch 폭주에도 DB offload(PREFETCH-504 동형). 무효화: revalidateTag('hero-banners') / 300s TTL.
//
// ⚠️ 보안: hero_banners는 민감 컬럼이 없어 전 컬럼 공개 OK(원가/재고/내부메모 없음).
//   is_active + 노출기간 필터로 비공개/예약/만료 배너를 명시 차단(RLS도 동일 조건 강제하나
//   service_role은 우회하므로 쿼리에서 직접 필터).
//
// 캐시 트레이드오프: 기간 필터의 now가 캐시 시점에 고정되어 노출 시작/종료가 최대 300s 지연될 수
//   있음(products.ts status 필터와 동형). 배너 노출 지연은 무해 — 정합보다 홈 성능 우선.

const fetchActiveHeroBannersFromDb = async (): Promise<HeroBanner[]> => {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("hero_banners")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[hero-banners] fetchActive failed:", error)
    return []
  }
  return data ?? []
}

const fetchActiveHeroBannersCached = unstable_cache(
  fetchActiveHeroBannersFromDb,
  ["hero-banners:active"],
  { revalidate: 300, tags: ["hero-banners"] },
)

/**
 * 홈 렌더용 활성 히어로 배너 목록. 무효화: revalidateTag('hero-banners') / 300s TTL.
 */
export const getActiveHeroBanners = async (): Promise<HeroBanner[]> =>
  fetchActiveHeroBannersCached()

// =============================================
// 어드민용 (service role, RLS 우회) — lib/banners.ts 패턴
// =============================================

export const getAllHeroBannersAdmin = async (): Promise<HeroBanner[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("hero_banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) throw error
  return data ?? []
}

export const getHeroBannerByIdAdmin = async (
  id: string
): Promise<HeroBanner | null> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("hero_banners")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data
}

export const createHeroBannerAdmin = async (
  input: HeroBannerInsert
): Promise<HeroBanner> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("hero_banners")
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateHeroBannerAdmin = async (
  id: string,
  input: HeroBannerUpdate
): Promise<HeroBanner> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("hero_banners")
    .update(input)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteHeroBannerAdmin = async (id: string): Promise<void> => {
  const admin = createAdminClient()
  const { error } = await admin.from("hero_banners").delete().eq("id", id)

  if (error) throw error
}

// =============================================
// 이미지 업로드 (product-images 버킷 'banners/' prefix — products/route.ts 패턴 상속)
// =============================================
// PC/모바일 분리 업로드. variant로 path 구분. 신규 버킷/RLS 불필요(기존 코드패스 재사용).
export const uploadHeroBannerImage = async (
  file: File,
  variant: "pc" | "mobile"
): Promise<string> => {
  const validation = validateImageFile(file)
  if (!validation.ok) throw new Error(validation.message)

  const admin = createAdminClient()
  const ext = file.name.split(".").pop() || "jpg"
  const path = `banners/${Date.now()}_${variant}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage
    .from("product-images")
    .upload(path, buffer, { contentType: file.type })
  if (error) throw new Error(`이미지 업로드 실패(${variant}): ${error.message}`)

  return admin.storage.from("product-images").getPublicUrl(path).data.publicUrl
}
