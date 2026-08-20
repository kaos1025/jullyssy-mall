import { unstable_cache } from "next/cache"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  EventCategory,
  EventCategoryInsert,
  EventCategoryUpdate,
  EventProduct,
  AdminEventProductRow,
  EventProductSort,
} from "@/lib/events-utils"

// 단일 import 표면 유지 — 서버 측 호출자는 lib/events에서 모두 가져갈 수 있다.
// 클라이언트 컴포넌트는 lib/events-utils에서 직접 import (서버 의존성 회피).
export {
  isValidHexColor,
  toProductCardProps,
} from "@/lib/events-utils"
export type {
  EventCategory,
  EventCategoryInsert,
  EventCategoryUpdate,
  EventProduct,
  AdminEventProductRow,
  EventProductSort,
} from "@/lib/events-utils"

// =============================================
// 공개용 (RSC — 캐시 격리)
// =============================================
// (shop)/layout.tsx(GNB 이벤트 탭)가 매 렌더 호출 — lib/banners.ts getActiveTopBanners와 동형
// (createAdminClient + unstable_cache, service_role 보상 필터·TTL 트레이드오프 설명은 그쪽 참조).
// 무효화: 어드민 이벤트 카테고리 mutation의 revalidateTag("event-categories") / 300s TTL.
const fetchActiveEventCategoriesFromDb = async (): Promise<EventCategory[]> => {
  const supabase = createAdminClient()
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

const fetchActiveEventCategoriesCached = unstable_cache(
  fetchActiveEventCategoriesFromDb,
  ["event-categories:active"],
  { revalidate: 300, tags: ["event-categories"] },
)

// 현재 노출 중인 활성 이벤트 카테고리 목록. 무효화: revalidateTag("event-categories") / 300s TTL.
export const getActiveEventCategories = async (): Promise<EventCategory[]> =>
  fetchActiveEventCategoriesCached()

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

// 어드민 리스트용 — 매칭 상품 수 포함.
// PostgREST nested count 신택스 사용 (event_category_products(count))
export const getAllEventCategoriesAdminWithCounts = async (): Promise<
  (EventCategory & { product_count: number })[]
> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("event_categories")
    .select("*, event_category_products(count)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    // event_category_products: [{ count: N }] 또는 빈 배열
    const counts = (row as { event_category_products?: { count: number }[] })
      .event_category_products
    const product_count = counts?.[0]?.count ?? 0
    // nested 필드는 응답에서 제거 (타입 호환)
    const {
      event_category_products: _ignored,
      ...rest
    } = row as EventCategory & { event_category_products?: unknown }
    void _ignored
    return { ...rest, product_count }
  })
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

// =============================================
// 이벤트 페이지 (anon, RLS 자동 필터)
// =============================================

// 이벤트 카테고리 + 매칭 상품 SSR 조회.
// 카테고리 비활성/기간 외 → null (404 트리거). 매칭 0건은 빈 products 배열.
export const getEventCategoryWithProducts = async (
  id: string,
  sortBy: EventProductSort = "admin"
): Promise<{ category: EventCategory; products: EventProduct[] } | null> => {
  const supabase = await createServerClient()
  const now = new Date().toISOString()

  const { data: category, error: catErr } = await supabase
    .from("event_categories")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .single()

  if (catErr || !category) return null

  const { data: rows, error: prodErr } = await supabase
    .from("event_category_products")
    .select(
      `
      display_order,
      products!inner (
        id,
        name,
        price,
        sale_price,
        slug,
        status,
        created_at,
        free_shipping,
        product_images (url, is_thumbnail, sort_order),
        product_options (color, stock),
        reviews (rating)
      )
      `
    )
    .eq("event_category_id", id)

  if (prodErr) {
    console.error("[events] getEventCategoryWithProducts products failed:", prodErr)
    return { category, products: [] }
  }

  // supabase-js는 N:1 join을 array 타입으로 추론하나 런타임은 단건/배열 모두 가능.
  // 정규화: 배열이면 [0], 객체면 그대로.
  type JoinedProduct = {
    id: string
    name: string
    price: number
    sale_price: number | null
    slug: string | null
    status: string | null
    created_at: string | null
    free_shipping: boolean
    product_images:
      | { url: string; is_thumbnail: boolean | null; sort_order: number | null }[]
      | null
    product_options: { color: string; stock: number | null }[] | null
    reviews: { rating: number }[] | null
  }
  const pickProduct = (raw: unknown): JoinedProduct | null => {
    if (!raw) return null
    if (Array.isArray(raw)) return (raw[0] as JoinedProduct) ?? null
    return raw as JoinedProduct
  }

  const products: EventProduct[] = (rows ?? [])
    .map((r) => {
      const p = pickProduct(r.products)
      if (!p) return null
      const ratings = (p.reviews ?? []).map((rv) => rv.rating)
      const review_count = ratings.length
      const review_avg =
        review_count > 0
          ? Math.round((ratings.reduce((s, n) => s + n, 0) / review_count) * 10) / 10
          : null
      return {
        display_order: r.display_order,
        id: p.id,
        name: p.name,
        price: p.price,
        sale_price: p.sale_price,
        slug: p.slug,
        status: p.status,
        created_at: p.created_at,
        free_shipping: p.free_shipping,
        product_images: p.product_images ?? [],
        product_options: p.product_options ?? [],
        review_count,
        review_avg,
      }
    })
    .filter((x): x is EventProduct => x !== null)

  // 정렬
  switch (sortBy) {
    case "newest":
      products.sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      )
      break
    case "price_asc":
      products.sort(
        (a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price)
      )
      break
    case "admin":
    default:
      products.sort(
        (a, b) =>
          a.display_order - b.display_order ||
          (b.created_at ?? "").localeCompare(a.created_at ?? "")
      )
  }

  return { category, products }
}

// =============================================
// 어드민 매칭 (service role, RLS 우회)
// =============================================

// 어드민 매칭 페이지용 — 비활성/품절 상품도 노출 (운영자 확인 필요).
export const getEventCategoryProductsAdmin = async (
  eventCategoryId: string
): Promise<AdminEventProductRow[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("event_category_products")
    .select(
      `
      display_order,
      created_at,
      products!inner (
        id,
        name,
        price,
        sale_price,
        status,
        product_images (url, is_thumbnail, sort_order)
      )
      `
    )
    .eq("event_category_id", eventCategoryId)

  if (error) throw error

  type JoinedAdminProduct = {
    id: string
    name: string
    price: number
    sale_price: number | null
    status: string | null
    product_images:
      | { url: string; is_thumbnail: boolean | null; sort_order: number | null }[]
      | null
  }
  const pickAdminProduct = (raw: unknown): JoinedAdminProduct | null => {
    if (!raw) return null
    if (Array.isArray(raw)) return (raw[0] as JoinedAdminProduct) ?? null
    return raw as JoinedAdminProduct
  }

  return (data ?? [])
    .map((r): AdminEventProductRow | null => {
      const p = pickAdminProduct(r.products)
      if (!p) return null
      const images = [...(p.product_images ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )
      const thumb =
        images.find((img) => img.is_thumbnail)?.url ?? images[0]?.url ?? null
      return {
        product_id: p.id,
        display_order: r.display_order,
        name: p.name,
        thumbnail_url: thumb,
        price: p.price,
        sale_price: p.sale_price,
        status: p.status,
      }
    })
    .filter((x): x is AdminEventProductRow => x !== null)
    .sort(
      (a, b) =>
        a.display_order - b.display_order ||
        a.name.localeCompare(b.name)
    )
}

// 매칭 추가 (멱등). 기존 매칭은 건너뜀(skipped 카운트).
// display_order는 현재 max + 1부터 입력 배열 순서대로 부여.
export const addEventCategoryProductsAdmin = async (
  eventCategoryId: string,
  productIds: string[]
): Promise<{ added: number; skipped: number }> => {
  if (productIds.length === 0) return { added: 0, skipped: 0 }

  const admin = createAdminClient()

  const { data: existingRows, error: existErr } = await admin
    .from("event_category_products")
    .select("product_id, display_order")
    .eq("event_category_id", eventCategoryId)

  if (existErr) throw existErr

  const existingIds = new Set((existingRows ?? []).map((r) => r.product_id))
  const maxOrder = (existingRows ?? []).reduce(
    (max, r) => Math.max(max, r.display_order),
    0
  )

  const toInsert = productIds
    .filter((pid) => !existingIds.has(pid))
    .map((pid, i) => ({
      event_category_id: eventCategoryId,
      product_id: pid,
      display_order: maxOrder + i + 1,
    }))

  const skipped = productIds.length - toInsert.length

  if (toInsert.length === 0) return { added: 0, skipped }

  const { error: insertErr } = await admin
    .from("event_category_products")
    .insert(toInsert)

  if (insertErr) throw insertErr

  return { added: toInsert.length, skipped }
}

// 단건 매칭 제거.
export const removeEventCategoryProductAdmin = async (
  eventCategoryId: string,
  productId: string
): Promise<void> => {
  const admin = createAdminClient()
  const { error } = await admin
    .from("event_category_products")
    .delete()
    .eq("event_category_id", eventCategoryId)
    .eq("product_id", productId)

  if (error) throw error
}

// 순서 일괄 변경. 입력된 (product_id, display_order) 쌍을 순차 update.
// PROMO-3 1차에서는 어드민 폼에서 입력값 저장 시 호출 (DnD는 P2).
export const updateEventCategoryProductOrderAdmin = async (
  eventCategoryId: string,
  ordering: { product_id: string; display_order: number }[]
): Promise<void> => {
  if (ordering.length === 0) return
  const admin = createAdminClient()

  for (const { product_id, display_order } of ordering) {
    const { error } = await admin
      .from("event_category_products")
      .update({ display_order })
      .eq("event_category_id", eventCategoryId)
      .eq("product_id", product_id)
    if (error) throw error
  }
}
