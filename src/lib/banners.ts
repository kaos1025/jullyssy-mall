import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/supabase"

export type TopBanner = Database["public"]["Tables"]["top_banners"]["Row"]
export type TopBannerInsert = Database["public"]["Tables"]["top_banners"]["Insert"]
export type TopBannerUpdate = Database["public"]["Tables"]["top_banners"]["Update"]

// CHECK constraint는 Supabase 타입 generator가 union literal로 변환하지 않음 (string으로 잡힘).
// 도메인에서는 다음 union을 사용하고, 입력 검증은 호출 측에서 수행.
export type BannerVariant = "normal" | "urgent"

// =============================================
// 공개용 (anon / RSC)
// =============================================

// 현재 노출 중인 활성 배너 목록.
// RLS가 동일 조건을 강제하지만, 캐싱/RSC에서 명시적으로 필터링.
export const getActiveTopBanners = async (): Promise<TopBanner[]> => {
  const supabase = await createServerClient()
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
