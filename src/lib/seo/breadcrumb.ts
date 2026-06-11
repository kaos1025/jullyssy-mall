// BreadcrumbList JSON-LD 빌더 (SEO-SCHEMA-BUNDLE-1 Phase 1).
//
// PDP에 `홈 > [1차 카테고리] > 카테고리 > 상품명` 경로를 schema.org BreadcrumbList로 노출.
// 카테고리는 단일 소속(products.category_id) + self-join parent_id(최대 2depth)이므로
// 대표 선정 분기 없음. URL은 절대 경로, slug는 encodeURIComponent로 안전 처리.

export interface BreadcrumbCrumb {
  name: string
  url: string
}

export interface BreadcrumbListItem {
  "@type": "ListItem"
  position: number
  name: string
  item: string
}

export interface BreadcrumbListJsonLd {
  "@context": "https://schema.org"
  "@type": "BreadcrumbList"
  itemListElement: BreadcrumbListItem[]
}

/** crumb 배열 → BreadcrumbList JSON-LD (position 1-base 순차 부여). */
export const buildBreadcrumbList = (
  crumbs: BreadcrumbCrumb[],
): BreadcrumbListJsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: crumb.url,
  })),
})

export interface ProductBreadcrumbInput {
  /** 사이트 절대 URL (예: https://jullyssy.shop). 끝 슬래시는 정규화됨. */
  siteUrl: string
  productName: string
  /** product.slug ?? product.id */
  productSlug: string
  /** 상품의 카테고리 (없을 수 있음). */
  category?: { name: string; slug: string } | null
  /** 1차(부모) 카테고리 (2depth일 때만). */
  parentCategory?: { name: string; slug: string } | null
}

/**
 * 상품 PDP용 BreadcrumbList 조립.
 * 홈 > [부모 카테고리] > 카테고리 > 상품명. 카테고리/부모 부재 시 해당 단계 생략.
 */
export const buildProductBreadcrumb = (
  input: ProductBreadcrumbInput,
): BreadcrumbListJsonLd => {
  const base = input.siteUrl.replace(/\/+$/, "")
  const categoryUrl = (slug: string) =>
    `${base}/products?category=${encodeURIComponent(slug)}`

  const crumbs: BreadcrumbCrumb[] = [{ name: "홈", url: `${base}/` }]

  if (input.parentCategory) {
    crumbs.push({
      name: input.parentCategory.name,
      url: categoryUrl(input.parentCategory.slug),
    })
  }
  if (input.category) {
    crumbs.push({
      name: input.category.name,
      url: categoryUrl(input.category.slug),
    })
  }
  crumbs.push({
    name: input.productName,
    url: `${base}/products/${encodeURIComponent(input.productSlug)}`,
  })

  return buildBreadcrumbList(crumbs)
}
