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

// =============================================
// 이벤트 페이지 상품 표시용 합성 타입
// =============================================
// event_category_products + products + product_images + product_options + reviews join 결과.
// ProductCard props와 호환되도록 toProductCardProps()로 변환해 사용.
export type EventProduct = {
  display_order: number
  id: string
  name: string
  price: number
  sale_price: number | null
  slug: string | null
  status: string | null
  created_at: string | null
  free_shipping: boolean
  product_images: { url: string; is_thumbnail: boolean | null; sort_order: number | null }[]
  product_options: { color: string; stock: number | null }[]
  review_count: number
  review_avg: number | null
}

// 어드민 매칭 페이지용 row (비활성/품절 포함) — 서버 헬퍼와 클라이언트 모두 공용.
export type AdminEventProductRow = {
  product_id: string
  display_order: number
  name: string
  thumbnail_url: string | null
  price: number
  sale_price: number | null
  status: string | null
}

// EventProduct → ProductCard props 변환 (썸네일/이미지/색상/리뷰 추출).
// ProductCard와 같은 추론 규칙 사용 (is_thumbnail 우선, 색상 unique, 리뷰 평균 1자리).
export const toProductCardProps = (ep: EventProduct) => {
  const sortedImages = [...ep.product_images].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
  const thumbnail =
    sortedImages.find((img) => img.is_thumbnail)?.url ??
    sortedImages[0]?.url ??
    null
  const images = sortedImages.map((img) => img.url)
  const colors = Array.from(new Set(ep.product_options.map((o) => o.color)))

  return {
    id: ep.id,
    name: ep.name,
    price: ep.price,
    sale_price: ep.sale_price,
    thumbnail,
    images,
    colors,
    review_count: ep.review_count,
    review_avg: ep.review_avg,
    slug: ep.slug,
    status: ep.status ?? undefined,
    created_at: ep.created_at ?? undefined,
    free_shipping: ep.free_shipping,
  }
}

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
