import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCategoriesAll } from "@/lib/categories"

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1.0 },
    { url: `${SITE_URL}/products`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/welcome`, changeFrequency: "monthly", priority: 0.6 },
  ]

  try {
    const supabase = createAdminClient()

    // 카테고리 페이지
    const categories = await getCategoriesAll()

    const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${SITE_URL}/products?category=${cat.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

    // 상품 상세 페이지
    const { data: products } = await supabase
      .from("products")
      .select("id, slug, updated_at")
      .eq("status", "ACTIVE")

    // 024 마이그레이션 적용 후 slug는 NOT NULL이지만, apply 전 빌드 안전망으로 필터링
    // (filter 술어로 slug: string 타입 narrowing → non-null assertion 불필요)
    const productPages: MetadataRoute.Sitemap = (products ?? [])
      .filter((p): p is typeof p & { slug: string } => Boolean(p.slug))
      .map((product) => ({
        url: `${SITE_URL}/products/${product.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        lastModified: product.updated_at,
      }))

    // 활성 이벤트 카테고리 (starts_at/ends_at 윈도우 내)
    const now = new Date().toISOString()
    const { data: events } = await supabase
      .from("event_categories")
      .select("id, updated_at")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)

    const eventPages: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
      url: `${SITE_URL}/events/${event.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      lastModified: event.updated_at,
    }))

    return [...staticPages, ...categoryPages, ...productPages, ...eventPages]
  } catch {
    // Supabase 조회 실패 시 고정 페이지만 반환
    return staticPages
  }
}

export default sitemap
