import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1.0 },
    { url: `${SITE_URL}/products`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.5 },
  ]

  try {
    const supabase = createAdminClient()

    // 카테고리 페이지
    const { data: categories } = await supabase
      .from("categories")
      .select("slug")
      .order("sort_order")

    const categoryPages: MetadataRoute.Sitemap = (categories ?? []).map(
      (cat) => ({
        url: `${SITE_URL}/products?category=${cat.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })
    )

    // 상품 상세 페이지
    const { data: products } = await supabase
      .from("products")
      .select("id, slug, updated_at")
      .eq("status", "ACTIVE")

    const productPages: MetadataRoute.Sitemap = (products ?? []).map(
      (product) => ({
        url: `${SITE_URL}/products/${product.slug || product.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        lastModified: product.updated_at,
      })
    )

    return [...staticPages, ...categoryPages, ...productPages]
  } catch {
    // Supabase 조회 실패 시 고정 페이지만 반환
    return staticPages
  }
}

export default sitemap
