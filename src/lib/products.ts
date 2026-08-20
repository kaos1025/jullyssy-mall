// 상품 목록 fetcher (캐시 격리) — PREFETCH-504 해소. lib/categories.ts 동형 패턴.
//
// (shop)/products 목록 쿼리가 createClient()(cookies 기반)라 페이지가 동적 SSR(캐시 MISS)로
// 빠져, 홈 진입 시 카테고리 메뉴 prefetch가 폭주하면 무거운 쿼리가 DB로 직행 → 25초 504.
// createAdminClient + unstable_cache로 격리해 데이터 레이어 캐시 HIT(라우트는 동적 유지하되
// DB 부하 제거). 무효화는 revalidateTag("products") 또는 300s TTL.
//
// ⚠️ 보안: service_role(RLS 우회)이므로
//   - .eq("status","ACTIVE") 필수 — 비공개/임시저장 상품 노출 차단.
//   - SELECT 화이트리스트만 — 원가/재고/내부 메모/naver_product_no 등 민감 컬럼 절대 금지.
//   - 사용자별 데이터(찜 등) 미포함 (목록은 공개 정적 데이터).

import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { escapePostgrestLikeValue } from "@/lib/supabase/search"

export type ProductSort = "price_asc" | "price_desc" | "popular" | "latest"

export const PRODUCT_SORTS: readonly ProductSort[] = [
  "price_asc",
  "price_desc",
  "popular",
  "latest",
] as const

export interface ProductListItem {
  id: string
  name: string
  slug: string | null
  price: number
  sale_price: number | null
  status: string
  created_at: string
  free_shipping: boolean
  product_images: { url: string; is_thumbnail: boolean; sort_order: number }[] | null
  product_options: { color: string }[] | null
  reviews: { count: number }[] | null
}

export interface ProductListResult {
  products: ProductListItem[]
  totalCount: number
}

// 홈 섹션 카드 아이템 — 홈은 리뷰 카운트를 렌더하지 않으므로 reviews 제외.
export type HomeProductItem = Omit<ProductListItem, "reviews">

// 카드 렌더 화이트리스트 (SSOT) — ProductCard가 실제 사용하는 컬럼 + 정렬키(created_at)만.
// 금지: description/description_raw/meta_title/meta_description/material/care_info/origin/search_tags
// (상세 전용 대형 텍스트 — 목록에 실리면 행당 수십 KB Egress) + naver_*·view_count 등 내부 컬럼.
// sell_count는 order 전용(미렌더)이라 select 안 함.
export const PRODUCT_CARD_SELECT = `
  id, name, slug, price, sale_price, status, created_at, free_shipping,
  product_images(url, is_thumbnail, sort_order),
  product_options(color)
`

// 목록/검색 SELECT = 카드 화이트리스트 + 리뷰 카운트.
const LIST_SELECT = `${PRODUCT_CARD_SELECT}, reviews(count)`

// 정렬 적용 (목록·검색 공유). supabase 빌더 .order()는 mutate 후 self 반환 → 미타입 admin
// client 캐스팅으로 체이닝. ProductSort 외 값은 default(latest)로 수렴.
interface Orderable {
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): Orderable
}
const applySort = <T>(query: T, sort: ProductSort): T => {
  const b = query as unknown as Orderable
  switch (sort) {
    case "price_asc":
      b.order("sale_price", { ascending: true, nullsFirst: false }).order("price", {
        ascending: true,
      })
      break
    case "price_desc":
      b.order("sale_price", { ascending: false, nullsFirst: true }).order("price", {
        ascending: false,
      })
      break
    case "popular":
      b.order("sell_count", { ascending: false })
      break
    default:
      b.order("created_at", { ascending: false })
  }
  return query
}

const fetchProductsFromDb = async (
  categoryIds: string[],
  sort: ProductSort,
  offset: number,
  pageSize: number,
): Promise<ProductListResult> => {
  const supabase = createAdminClient()

  let query = supabase
    .from("products")
    .select(LIST_SELECT, { count: "exact" })
    .eq("status", "ACTIVE")

  // categoryIds 빈 배열이면 필터 미적용(전체) — .in("category_id", [])는 0건 매치라 호출 금지.
  if (categoryIds.length > 0) {
    query = query.in("category_id", categoryIds)
  }

  query = applySort(query, sort)

  const { data, count, error } = await query.range(offset, offset + pageSize - 1)
  if (error) throw new Error(error.message)

  return {
    products: (data ?? []) as unknown as ProductListItem[],
    totalCount: count ?? 0,
  }
}

const fetchProductsCached = unstable_cache(
  fetchProductsFromDb,
  ["products:list"],
  { revalidate: 300, tags: ["products"] },
)

/**
 * 상품 목록 + 총개수 (캐시 격리). 무효화: revalidateTag("products") / 300s TTL.
 * categoryIds는 정렬해 전달 — 순서 차이로 인한 캐시 키 분기(미스) 방지.
 */
export const getProductsList = async (
  categoryIds: string[],
  sort: ProductSort,
  offset: number,
  pageSize: number,
): Promise<ProductListResult> => {
  const sortedIds = [...categoryIds].sort()
  return fetchProductsCached(sortedIds, sort, offset, pageSize)
}

// ── 검색 (name ILIKE) ─────────────────────────────────────────────────────
// 목록과 동일 보안/캐시 격리: createAdminClient + status=ACTIVE + 화이트리스트 +
// unstable_cache(tags ["products"]). /search prefetch 폭주에도 DB offload (PREFETCH-504 동형).
const fetchSearchFromDb = async (
  q: string,
  sort: ProductSort,
  offset: number,
  pageSize: number,
): Promise<ProductListResult> => {
  const supabase = createAdminClient()

  // escapePostgrestLikeValue로 ,()*\ 제거 — % _ 는 fuzzy 유지. ilike 빌더라 파라미터화됨.
  const pattern = `%${escapePostgrestLikeValue(q)}%`
  let query = supabase
    .from("products")
    .select(LIST_SELECT, { count: "exact" })
    .eq("status", "ACTIVE")
    .ilike("name", pattern)

  query = applySort(query, sort)

  const { data, count, error } = await query.range(offset, offset + pageSize - 1)
  if (error) throw new Error(error.message)

  return {
    products: (data ?? []) as unknown as ProductListItem[],
    totalCount: count ?? 0,
  }
}

const fetchSearchCached = unstable_cache(fetchSearchFromDb, ["products:search"], {
  revalidate: 300,
  tags: ["products"],
})

/**
 * 상품명 검색 + 총개수 (캐시 격리). 무효화: revalidateTag("products") / 300s TTL.
 * q는 trim+lowercase로 정규화 — 캐시 키 안정화(빈 q는 호출 측에서 사전 차단 권장).
 */
export const getSearchResults = async (
  rawQuery: string,
  sort: ProductSort,
  offset: number,
  pageSize: number,
): Promise<ProductListResult> => {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return { products: [], totalCount: 0 }
  return fetchSearchCached(q, sort, offset, pageSize)
}

// ── 홈 섹션 (NEW ARRIVAL / WEEKLY BEST) ───────────────────────────────────
// 홈은 방문(봇 포함)마다 products.* 2쿼리(created_at/sell_count DESC)가 cookies 기반 dynamic SSR로
// DB 직행하던 IO/Egress 주범(pg_stat_statements 28k×2, 2026-08-20 실측). 동일 격리 패턴 적용.
// 두 정렬을 단일 캐시 엔트리로 묶되 DB 쿼리는 LIMIT 8 ×2 병렬 유지 — 전체 ACTIVE 1쿼리 + 앱 정렬보다
// miss당 payload(행·이미지 수)가 훨씬 작다. 상품 mutation의 revalidateTag("products")가 함께 무효화.
const HOME_SECTION_LIMIT = 8

export interface HomeProducts {
  newProducts: HomeProductItem[]
  popularProducts: HomeProductItem[]
}

const fetchHomeProductsFromDb = async (): Promise<HomeProducts> => {
  const supabase = createAdminClient()
  const activeCards = () =>
    supabase.from("products").select(PRODUCT_CARD_SELECT).eq("status", "ACTIVE")

  const [newest, popular] = await Promise.all([
    activeCards().order("created_at", { ascending: false }).limit(HOME_SECTION_LIMIT),
    activeCards().order("sell_count", { ascending: false }).limit(HOME_SECTION_LIMIT),
  ])
  if (newest.error) throw new Error(newest.error.message)
  if (popular.error) throw new Error(popular.error.message)

  return {
    newProducts: (newest.data ?? []) as unknown as HomeProductItem[],
    popularProducts: (popular.data ?? []) as unknown as HomeProductItem[],
  }
}

const fetchHomeProductsCached = unstable_cache(fetchHomeProductsFromDb, ["products:home"], {
  revalidate: 300,
  tags: ["products"],
})

/**
 * 홈 신상품/인기상품 각 8개 (캐시 격리). 무효화: revalidateTag("products") / 300s TTL.
 * 에러는 throw — ISR 재생성 실패 시 Next가 직전 정상 페이지를 유지하고, 빌드 시엔 실패를 드러낸다.
 */
export const getHomeProducts = async (): Promise<HomeProducts> => fetchHomeProductsCached()
