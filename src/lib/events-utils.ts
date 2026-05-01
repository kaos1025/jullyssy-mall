// =============================================
// 이벤트 카테고리 — 클라이언트/서버 공용 유틸 (서버 의존성 없음)
// =============================================
// lib/events.ts는 next/headers를 트랜지티브 import 하므로,
// 클라이언트 컴포넌트는 반드시 이 파일에서 import해야 한다.

import type { Database } from "@/types/supabase"

export type EventCategory =
  Database["public"]["Tables"]["event_categories"]["Row"]
export type EventCategoryInsert =
  Database["public"]["Tables"]["event_categories"]["Insert"]
export type EventCategoryUpdate =
  Database["public"]["Tables"]["event_categories"]["Update"]

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
