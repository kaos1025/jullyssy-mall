// 카테고리 단일 fetcher (전역 캐시 적용).
//
// Day 28 CATEGORIES-CACHE-AUDIT-1 (P0): GNB/PDP/필터/sidebar가 같은 정적
// 데이터를 페이지 진입마다 4~6회 재조회하던 패턴(60분 28,972 calls)을
// 단일 fetch + 두 레이어 캐시로 수렴.
//
// - createAdminClient: service_role 사용. categories는 RLS public read이지만
//   `unstable_cache` 내부에서는 cookies() 컨텍스트(createClient)가 dynamic으로
//   판정되어 캐시가 무력화되므로 service_role로 격리.
// - unstable_cache: 1시간 revalidate + tag 'categories'로 명시 무효화.
// - cache (React): 같은 요청 내 중복 호출을 in-memory 메모이제이션.
// - 호출처는 helper로 in-memory filter (DB 추가 query 0).

import { cache } from "react"
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Category } from "@/types"

const fetchAllFromDb = async (): Promise<Category[]> => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Category[]
}

const fetchAllCached = unstable_cache(
  fetchAllFromDb,
  ["categories:all"],
  { revalidate: 3600, tags: ["categories"] },
)

export const getCategoriesAll = cache(async (): Promise<Category[]> => {
  return fetchAllCached()
})

export const getCategoryBySlug = async (
  slug: string,
): Promise<Category | null> => {
  const all = await getCategoriesAll()
  return all.find((c) => c.slug === slug) ?? null
}

export const getCategoryById = async (
  id: string,
): Promise<Category | null> => {
  const all = await getCategoriesAll()
  return all.find((c) => c.id === id) ?? null
}

export const getRootCategories = async (): Promise<Category[]> => {
  const all = await getCategoriesAll()
  return all.filter((c) => c.parent_id === null)
}

export const getChildrenOf = async (parentId: string): Promise<Category[]> => {
  const all = await getCategoriesAll()
  return all.filter((c) => c.parent_id === parentId)
}
