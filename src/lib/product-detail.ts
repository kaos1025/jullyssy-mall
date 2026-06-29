// PDP(/products/[id]) 데이터 캐시 격리 — PREFETCH 지연 완화(데이터 캐시안, route ISR은 보류).
// lib/products.ts(#59) 동형: createAdminClient + unstable_cache(tags ["products"]).
// page는 동적 유지(auth.getUser/writableOrderItem은 page에 잔존) — 여기선 공개 데이터만 캐시.
//
// ⚠️ 보안: service_role(RLS 우회) → products는 SELECT 화이트리스트(naver_product_no/view_count/
// sell_count/meta_title 등 제외), profiles 조인은 리뷰 표시 필드(name/height/weight)만(이메일/전화 등 제외).
// revalidate 600s는 안전망 — 상품/리뷰 mutation의 revalidateTag("products")가 1차 무효화.

import { cache } from "react"
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { UUID_RE } from "@/lib/slug"
import { sanitizeDescriptionHtml } from "@/lib/product/sanitize-description"
import type { ProductImage, ProductOption } from "@/types"

const REVALIDATE = 600

export interface ProductDetail {
  id: string
  category_id: string | null
  name: string
  slug: string | null
  description: string | null
  meta_description: string | null
  price: number
  sale_price: number | null
  status: string
  material: string | null
  care_info: string | null
  origin: string | null
  fit_type: string | null
  free_shipping: boolean
  search_tags: string[] | null
  category: { id: string; name: string; slug: string; parent_id: string | null } | null
  product_images: ProductImage[]
  product_options: ProductOption[]
}

export interface RelatedProduct {
  id: string
  name: string
  slug: string | null
  price: number
  sale_price: number | null
  status: string
  created_at: string
  free_shipping: boolean
  product_images: { url: string; is_thumbnail: boolean; sort_order: number }[]
  product_options: { color: string }[]
}

// products 화이트리스트 (민감 컬럼 제외). 중첩(images/options)은 민감 컬럼 없어 그대로.
const PRODUCT_DETAIL_SELECT = `
  id, category_id, name, slug, description, meta_description, price, sale_price,
  status, material, care_info, origin, fit_type, free_shipping, search_tags,
  category:categories(id, name, slug, parent_id),
  product_images(*),
  product_options(*)
`

const fetchProductDetailFromDb = async (
  idOrSlug: string,
): Promise<ProductDetail | null> => {
  const supabase = createAdminClient()
  const isUuid = UUID_RE.test(idOrSlug)
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .eq("status", "ACTIVE")
    .maybeSingle() // 0건은 null(throw 금지) → page가 notFound() 처리
  if (error) throw new Error(error.message)
  if (!data) return null // 0건은 null(throw 금지) → page가 notFound() 처리
  const detail = data as unknown as ProductDetail
  // 렌더 출력 경계 sanitize(XSS 하드닝). 캐시에 정화본 적재 → 요청당 재정화 없음. DB 원본 불변.
  return { ...detail, description: sanitizeDescriptionHtml(detail.description) }
}

const fetchProductDetailCached = unstable_cache(
  fetchProductDetailFromDb,
  ["product:detail"],
  { revalidate: REVALIDATE, tags: ["products"] },
)

/**
 * PDP 상품 본체 (공개 데이터). React cache()로 같은 요청 내 page↔generateMetadata 중복 조회 dedupe,
 * unstable_cache로 요청 간 DB offload. idOrSlug(decodeURIComponent된 값)로 캐시 키 일치.
 */
export const getProductDetail = cache((idOrSlug: string) =>
  fetchProductDetailCached(idOrSlug),
)

// ── 리뷰 (+이미지 +작성자 표시필드) ───────────────────────────────────────
const fetchReviewsFromDb = async (productId: string) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("reviews")
    // 화이트리스트: 표시 컬럼만. user_id/order_item_id 등 미표시 식별자 제외(공유 캐시 노출 최소화).
    // profiles 조인도 표시필드(name/height/weight)만 — 이메일/전화 등 제외.
    .select(
      `id, product_id, rating, content, height, weight, purchased_size,
       tag_size, tag_color, tag_thickness, tag_stretch, helpful_count, created_at,
       images:review_images(*), user:profiles(name, height, weight)`,
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export const getProductReviews = unstable_cache(
  fetchReviewsFromDb,
  ["product:reviews"],
  { revalidate: REVALIDATE, tags: ["products"] },
)

// ── 리뷰 태그 4축 집계 (RPC) ───────────────────────────────────────────────
const fetchTagSummaryFromDb = async (productId: string) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("get_product_review_tag_summary", {
    p_product_id: productId,
  })
  if (error) throw new Error(error.message)
  return data ?? []
}

export const getProductTagSummary = unstable_cache(
  fetchTagSummaryFromDb,
  ["product:tagsummary"],
  { revalidate: REVALIDATE, tags: ["products"] },
)

// ── 관련 상품 (같은 카테고리, 현재 제외) ──────────────────────────────────
const fetchRelatedFromDb = async (
  categoryId: string,
  excludeId: string,
): Promise<RelatedProduct[]> => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, slug, price, sale_price, status, created_at, free_shipping,
       product_images(url, is_thumbnail, sort_order),
       product_options(color)`,
    )
    .eq("category_id", categoryId)
    .eq("status", "ACTIVE")
    .neq("id", excludeId)
    .limit(8)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RelatedProduct[]
}

export const getRelatedProducts = unstable_cache(
  fetchRelatedFromDb,
  ["product:related"],
  { revalidate: REVALIDATE, tags: ["products"] },
)
