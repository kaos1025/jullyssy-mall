import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/types/supabase"

export type EventCategory = Database["public"]["Tables"]["event_categories"]["Row"]
export type EventCategoryInsert =
  Database["public"]["Tables"]["event_categories"]["Insert"]
export type EventCategoryUpdate =
  Database["public"]["Tables"]["event_categories"]["Update"]

// =============================================
// 검증 헬퍼 (API 라우트/UI에서 공용)
// =============================================

// #RRGGBB 형식만 허용. 단축형(#RGB)/투명도(#RRGGBBAA) 비허용.
export const isValidHexColor = (color: string): boolean =>
  /^#[0-9A-Fa-f]{6}$/.test(color)

// http(s):// 절대 URL이고 호스트가 NEXT_PUBLIC_SITE_URL과 다르면 외부 링크.
// 상대 경로(/products...)는 내부로 간주. SITE_URL 미설정 시 절대 URL은 보수적으로 외부 처리.
export const isExternalUrl = (url: string): boolean => {
  if (!url || !/^https?:\/\//i.test(url)) return false
  try {
    const target = new URL(url)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) return true
    return target.host !== new URL(siteUrl).host
  } catch {
    return false
  }
}

// =============================================
// 공개용 (anon / RSC)
// =============================================

// 현재 노출 중인 활성 이벤트 카테고리 목록.
// RLS가 동일 조건을 강제하지만, 캐싱/RSC에서 명시적으로 필터링.
export const getActiveEventCategories = async (): Promise<EventCategory[]> => {
  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("event_categories")
    .select("*")
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("display_order", { ascending: true })

  if (error) {
    console.error("[events] getActiveEventCategories failed:", error)
    return []
  }

  return data ?? []
}

// =============================================
// 어드민용 (service role, RLS 우회)
// =============================================

export const getAllEventCategoriesAdmin = async (): Promise<EventCategory[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("event_categories")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) throw error
  return data ?? []
}

export const getEventCategoryByIdAdmin = async (
  id: string
): Promise<EventCategory | null> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("event_categories")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw error
  }
  return data
}

export const createEventCategoryAdmin = async (
  input: EventCategoryInsert
): Promise<EventCategory> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("event_categories")
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateEventCategoryAdmin = async (
  id: string,
  input: EventCategoryUpdate
): Promise<EventCategory> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("event_categories")
    .update(input)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export const deleteEventCategoryAdmin = async (id: string): Promise<void> => {
  const admin = createAdminClient()
  const { error } = await admin.from("event_categories").delete().eq("id", id)

  if (error) throw error
}
