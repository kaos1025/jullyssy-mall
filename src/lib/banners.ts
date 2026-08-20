import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/supabase"

export type TopBanner = Database["public"]["Tables"]["top_banners"]["Row"]
export type TopBannerInsert = Database["public"]["Tables"]["top_banners"]["Insert"]
export type TopBannerUpdate = Database["public"]["Tables"]["top_banners"]["Update"]

// CHECK constraint는 Supabase 타입 generator가 union literal로 변환하지 않음 (string으로 잡힘).
// 도메인에서는 다음 union을 사용하고, 입력 검증은 호출 측에서 수행.
export type BannerVariant = "normal" | "urgent"

// =============================================
// 공개용 (RSC — 캐시 격리)
// =============================================
// (shop)/layout.tsx가 매 렌더 호출. 종전 createServerClient(cookies)라 모든 shop 라우트를 dynamic으로
// 끌고 가며 DB 직행 → lib/hero-banners.ts 패턴(createAdminClient + unstable_cache)으로 격리.
// 무효화: 어드민 배너 mutation의 revalidateTag("top-banners") / 300s TTL.
//
// ⚠️ service_role은 RLS를 우회하므로 is_active + 노출기간 필터를 쿼리에서 직접 강제(민감 컬럼 없음).
// 캐시 트레이드오프: 기간 필터의 now가 캐시 시점에 고정 → 예약 시작/종료 반영이 최대 TTL만큼 지연(무해).
const fetchActiveTopBannersFromDb = async (): Promise<TopBanner[]> => {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("top_banners")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[banners] getActiveTopBanners failed:", error)
    return []
  }

  return data ?? []
}

const fetchActiveTopBannersCached = unstable_cache(
  fetchActiveTopBannersFromDb,
  ["top-banners:active"],
  { revalidate: 300, tags: ["top-banners"] },
)

// 현재 노출 중인 활성 배너 목록. 무효화: revalidateTag("top-banners") / 300s TTL.
export const getActiveTopBanners = async (): Promise<TopBanner[]> =>
  fetchActiveTopBannersCached()

// =============================================
// 어드민용 (service role, RLS 우회)
// =============================================

export const getAllTopBannersAdmin = async (): Promise<TopBanner[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("top_banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) throw error
  return data ?? []
}

export const getTopBannerByIdAdmin = async (
  id: string
): Promise<TopBanner | null> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("top_banners")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data
}

export const createTopBannerAdmin = async (
  input: TopBannerInsert
): Promise<TopBanner> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("top_banners")
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateTopBannerAdmin = async (
  id: string,
  input: TopBannerUpdate
): Promise<TopBanner> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("top_banners")
    .update(input)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteTopBannerAdmin = async (id: string): Promise<void> => {
  const admin = createAdminClient()
  const { error } = await admin.from("top_banners").delete().eq("id", id)

  if (error) throw error
}
