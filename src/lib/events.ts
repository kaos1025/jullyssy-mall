import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  EventCategory,
  EventCategoryInsert,
  EventCategoryUpdate,
} from "@/lib/events-utils"

// 단일 import 표면 유지 — 서버 측 호출자는 lib/events에서 모두 가져갈 수 있다.
// 클라이언트 컴포넌트는 lib/events-utils에서 직접 import (서버 의존성 회피).
export {
  isValidHexColor,
  isExternalUrl,
} from "@/lib/events-utils"
export type {
  EventCategory,
  EventCategoryInsert,
  EventCategoryUpdate,
} from "@/lib/events-utils"

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
