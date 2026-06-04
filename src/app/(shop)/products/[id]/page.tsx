import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { PackageOpen, MessageSquare, HelpCircle, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getCategoryById } from "@/lib/categories"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import ImageGallery from "@/components/product/ImageGallery"
import ProductOptions from "@/components/product/ProductOptions"
import ProductReviews from "@/components/product/ProductReviews"
import ProductDescription from "@/components/product/ProductDescription"
import ProductCard from "@/components/product/ProductCard"
import ShareButton from "@/components/product/ShareButton"
import ReviewTagSummary from "@/components/review/ReviewTagSummary"
import MiniReviewCarousel from "@/components/review/MiniReviewCarousel"
import { SHOPPING_GUIDE } from "@/constants/shopping-guide"
import { BUSINESS_INFO } from "@/constants/business"
import { SHIPPING_CONFIG } from "@/constants/shipping"
import { FIT_TYPE_LABELS, parseFitType } from "@/lib/product/fit-type"
import { getProductLdDescription } from "@/lib/seo/product-ld-description"
import type { Metadata } from "next"
import type { ReviewWithImages } from "@/types"
import type { ReviewTagSummaryRow } from "@/types/review"
import { UUID_RE } from "@/lib/slug"

const REVIEW_TAG_SUMMARY_THRESHOLD = 10
const MINI_REVIEW_CAROUSEL_THRESHOLD = 3
const MINI_REVIEW_LIMIT = 8

interface ProductDetailPageProps {
  params: { id: string }
}

export const generateMetadata = async ({
  params,
}: ProductDetailPageProps): Promise<Metadata> => {
  try {
    const supabase = await createClient()
    // params.id는 Next.js App Router에서 percent-encoded 상태로 전달될 수 있음
    // (한글 slug URL — decode 안 하면 DB 매치 0건)
    const id = decodeURIComponent(params.id)
    const isUuid = UUID_RE.test(id)
    const { data: product } = await supabase
      .from("products")
      .select("id, slug, name, description, meta_description, price, sale_price, search_tags, product_images(url, is_thumbnail)")
      .eq(isUuid ? "id" : "slug", id)
      .eq("status", "ACTIVE")
      .single()

    if (!product) return { title: "상품 상세" }

    const displayPrice = product.sale_price ?? product.price
    const thumbnail =
      product.product_images?.find(
        (img: { is_thumbnail: boolean }) => img.is_thumbnail
      )?.url || product.product_images?.[0]?.url

    return {
      title: product.name,
      description: `${product.name} | ${displayPrice.toLocaleString()}원 | 쥴리씨`,
      openGraph: {
        title: product.name,
        // PDP-LD-DESC-1: 안내문 오염 제거 — meta_description(AI) → body strip → name
        description: getProductLdDescription(product, 160),
        ...(thumbnail && {
          images: [{ url: thumbnail, width: 800, height: 1067, alt: product.name }],
        }),
      },
      keywords: [
        product.name,
        ...(product.search_tags ?? []),
        "여성의류",
        "쥴리씨",
      ],
      alternates: {
        canonical: `/products/${product.slug || product.id}`,
      },
    }
  } catch {
    return { title: "상품 상세" }
  }
}

const ProductDetailPage = async ({ params }: ProductDetailPageProps) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // params.id는 Next.js App Router에서 percent-encoded 상태로 전달될 수 있음
  // (한글 slug URL — decode 안 하면 DB 매치 0건)
  const id = decodeURIComponent(params.id)
  const isUuid = UUID_RE.test(id)
  const { data: product } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories(id, name, slug, parent_id),
      product_images(*),
      product_options(*)
    `
    )
    .eq(isUuid ? "id" : "slug", id)
    .eq("status", "ACTIVE")
    .single()

  if (!product) notFound()

  // UUID 접근이면서 slug 보유 시 → slug URL로 308 영구 리다이렉트
  // (어드민 즐겨찾기 / 외부 공유 링크 / 검색엔진 색인 자동 갱신)
  // permanentRedirect는 throw 기반이라 이후 코드는 실행되지 않음
  // NOTE: Next.js 14.2 RSC streaming context에서는 308 status 대신 meta refresh 폴백으로
  // 응답될 수 있음 (Sentry 영향 아닌 known design — P1-13, Phase 1~5 격리 진단 완료).
  if (isUuid && product.slug) {
    permanentRedirect(`/products/${product.slug}`)
  }

  // 작성 가능 order_item 사전 조회 (로그인 + 현재 상품 × CONFIRMED + 미작성)
  // 보유 시에만 PDP 리뷰 탭에 "이 상품 리뷰 쓰기" 링크 노출
  let writableOrderItem: { id: string } | null = null
  if (user) {
    const { data } = await supabase
      .from("order_items")
      .select("id, orders!inner(user_id, status, created_at)")
      .eq("product_id", product.id)
      .eq("orders.user_id", user.id)
      .eq("orders.status", "CONFIRMED")
      .eq("is_reviewed", false)
      .order("created_at", { referencedTable: "orders", ascending: false })
      .limit(1)
      .maybeSingle()
    writableOrderItem = data as { id: string } | null
  }

  // 부모 카테고리 조회
  let parentCategory: { name: string; slug: string } | null = null
  if (product.category?.parent_id) {
    const parent = await getCategoryById(product.category.parent_id)
    parentCategory = parent
      ? { name: parent.name, slug: parent.slug }
      : null
  }

  // 리뷰 + 태그 집계 조회 (PDP SSR 시 함께 prefetch)
  const [{ data: reviews }, { data: tagSummaryData }] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        `
      *,
      images:review_images(*),
      user:profiles(name, height, weight)
    `
      )
      .eq("product_id", product.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_product_review_tag_summary", {
      p_product_id: product.id,
    }),
  ])
  const tagSummaryRows =
    ((tagSummaryData as unknown) as ReviewTagSummaryRow[] | null) ?? []

  // 관련상품 조회 (같은 카테고리, 현재 상품 제외)
  let relatedProducts: typeof product[] = []
  if (product.category_id) {
    const { data: related } = await supabase
      .from("products")
      .select("*, product_images(url, is_thumbnail, sort_order), product_options(color)")
      .eq("category_id", product.category_id)
      .eq("status", "ACTIVE")
      .neq("id", product.id)
      .limit(8)
    relatedProducts = related || []
  }

  const typedReviews = (reviews || []) as unknown as ReviewWithImages[]
  const averageRating =
    typedReviews.length > 0
      ? typedReviews.reduce((sum, r) => sum + r.rating, 0) /
        typedReviews.length
      : 0

  // 미니 캐러셀: 사진 있는 리뷰 우선, 그 다음 최신순
  const miniReviews = [...typedReviews]
    .sort((a, b) => {
      const ai = a.images?.length ? 1 : 0
      const bi = b.images?.length ? 1 : 0
      if (bi !== ai) return bi - ai
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, MINI_REVIEW_LIMIT)

  const showTagSummary = typedReviews.length >= REVIEW_TAG_SUMMARY_THRESHOLD
  const showMiniCarousel =
    typedReviews.length >= MINI_REVIEW_CAROUSEL_THRESHOLD

  const images = product.product_images?.sort(
    (a: { sort_order: number }, b: { sort_order: number }) =>
      a.sort_order - b.sort_order
  ) || []

  const thumbnail = images.find(
    (img: { is_thumbnail: boolean }) => img.is_thumbnail
  )?.url || images[0]?.url || null

  const discountRate = product.sale_price
    ? Math.round(
        ((product.price - product.sale_price) / product.price) * 100
      )
    : 0

  // JSON-LD 구조화 데이터
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: thumbnail ? [thumbnail] : [],
    // PDP-LD-DESC-1: 상품 묘사 소스 — meta_description(AI) → body 안내문 strip → name
    description: getProductLdDescription(product, 200),
    brand: { "@type": "Brand", name: "쥴리씨" },
    sku: product.id,
    offers: {
      "@type": "Offer",
      price: product.sale_price || product.price,
      priceCurrency: "KRW",
      availability:
        product.status === "ACTIVE"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: BUSINESS_INFO.companyName },
      url: `${SITE_URL}/products/${product.slug || product.id}`,
      // v0.8 Track 1-D — 반품정책 SSOT: 약관 제14조 (수령 후 7일, 변심 시 왕복배송비 고객 부담)
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "KR",
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
      },
      // v0.8 Track 1-D — 배송 SSOT: SHIPPING_CONFIG (무료배송 상품은 0원, 1~3 영업일)
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: product.free_shipping ? 0 : SHIPPING_CONFIG.baseFee,
          currency: "KRW",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "KR",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          businessDays: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
          },
        },
      },
    },
  }

  if (typedReviews.length > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: averageRating.toFixed(1),
      reviewCount: typedReviews.length,
      bestRating: 5,
      worstRating: 1,
    }
  }

  // v0.8 Track 1-A A-5 / 마무리 M-2 — fit·material을 additionalProperty로 노출
  // (SSOT: fit-type.ts). 비의류 fit_type NULL(Track G)·material 빈값이면 해당 항목 미emit.
  const fitType = parseFitType(product.fit_type)
  const fitLabel = fitType ? FIT_TYPE_LABELS[fitType] : null
  const additionalProperty: Array<{
    "@type": "PropertyValue"
    name: string
    value: string
  }> = []
  if (fitLabel) {
    additionalProperty.push({ "@type": "PropertyValue", name: "fit", value: fitLabel })
  }
  if (product.material) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "material",
      value: product.material,
    })
  }
  if (additionalProperty.length > 0) {
    jsonLd.additionalProperty = additionalProperty
  }

  return (
    <div className="container py-4 md:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        {/* 좌측: 이미지 갤러리 */}
        <ImageGallery images={images} />

        {/* 우측: 상품 정보 + 옵션 */}
        <div className="md:sticky md:top-20 md:self-start space-y-4">
          {/* 카테고리 breadcrumb + 공유 */}
          <div className="flex items-center justify-between">
            {product.category ? (
              <p className="text-xs text-muted-foreground">
                {parentCategory
                  ? `${parentCategory.name} > ${product.category.name}`
                  : product.category.name}
              </p>
            ) : (
              <div />
            )}
            <ShareButton
              title={product.name}
              text={`${product.name} | ${(product.sale_price ?? product.price).toLocaleString()}원`}
            />
          </div>

          {/* 상품명 */}
          <h1 className="text-lg font-bold">{product.name}</h1>

          {/* 가격 */}
          <div className="space-y-1">
            {discountRate > 0 && (
              <span className="text-xl font-bold text-primary">
                {discountRate}%
              </span>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold">
                {(product.sale_price ?? product.price).toLocaleString()}원
              </span>
              {product.sale_price && (
                <span className="text-sm text-muted-foreground line-through">
                  {product.price.toLocaleString()}원
                </span>
              )}
            </div>
          </div>

          {/* 무료배송 뱃지 */}
          {product.free_shipping && (
            <span className="inline-block text-xs text-primary font-medium border border-primary/30 rounded px-1.5 py-0.5">
              무료배송
            </span>
          )}

          {/* 리뷰 요약 */}
          {typedReviews.length > 0 && (
            <a
              href="#reviews"
              className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ★ {averageRating.toFixed(1)} ({typedReviews.length}개의 리뷰)
            </a>
          )}

          {/* 소재/원산지/세탁방법 — 접기/펼치기 */}
          {(product.material || product.origin || product.care_info) && (
            <Accordion type="single" collapsible>
              <AccordionItem value="product-info" className="border-b-0">
                <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                  상품 정보
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-sm pb-2">
                    {product.material && (
                      <div className="flex">
                        <span className="w-20 text-muted-foreground">소재</span>
                        <span>{product.material}</span>
                      </div>
                    )}
                    {product.origin && (
                      <div className="flex">
                        <span className="w-20 text-muted-foreground">원산지</span>
                        <span>{product.origin}</span>
                      </div>
                    )}
                    {product.care_info && (
                      <div className="flex">
                        <span className="w-20 text-muted-foreground">세탁방법</span>
                        <span>{product.care_info}</span>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          <div className="border-t pt-4">
            {/* 옵션 선택 + 장바구니/구매 */}
            <ProductOptions
              productId={product.id}
              productName={product.name}
              productImage={thumbnail}
              price={product.price}
              salePrice={product.sale_price}
              freeShipping={product.free_shipping === true}
              options={product.product_options || []}
            />
          </div>
        </div>
      </div>

      {/* 리뷰 4축 평가 요약 (10개 이상일 때만) */}
      {showTagSummary && (
        <ReviewTagSummary
          rows={tagSummaryRows}
          reviewCount={typedReviews.length}
        />
      )}

      {/* 미니 리뷰 캐러셀 (3개 이상일 때만) */}
      {showMiniCarousel && (
        <MiniReviewCarousel reviews={miniReviews} reviewsTabHref="#reviews" />
      )}

      {/* 탭: 4탭 */}
      <div className="mt-12" id="reviews">
        <Tabs defaultValue="description">
          <TabsList className="grid grid-cols-4 w-full border-b border-gray-200 bg-transparent p-0 h-auto rounded-none gap-0">
            {[
              { value: "description", label: "상세설명" },
              { value: "related", label: "관련상품" },
              { value: "reviews", label: `구매후기${typedReviews.length > 0 ? ` (${typedReviews.length})` : ""}` },
              { value: "qna", label: "상품문의" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs md:text-sm py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground bg-transparent justify-center"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 상세설명 */}
          <TabsContent value="description" className="mt-6">
            {product.description ? (
              <ProductDescription html={product.description} />
            ) : (
              <p className="text-center py-10 text-muted-foreground">
                상세설명이 없습니다.
              </p>
            )}
          </TabsContent>

          {/* 관련상품 */}
          <TabsContent value="related" className="mt-6">
            {relatedProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                {relatedProducts.map((rp) => {
                  const rpImages = (rp.product_images ?? [])
                    .sort((a: { sort_order?: number }, b: { sort_order?: number }) =>
                      (a.sort_order ?? 0) - (b.sort_order ?? 0)
                    )
                  const rpThumb =
                    rpImages.find((img: { is_thumbnail: boolean }) => img.is_thumbnail)?.url ||
                    rpImages[0]?.url ||
                    null
                  const rpColors = Array.from(
                    new Set((rp.product_options ?? []).map((o: { color: string }) => o.color))
                  ) as string[]
                  return (
                    <ProductCard
                      key={rp.id}
                      id={rp.id}
                      name={rp.name}
                      slug={rp.slug}
                      price={rp.price}
                      sale_price={rp.sale_price}
                      thumbnail={rpThumb}
                      images={rpImages.map((img: { url: string }) => img.url)}
                      colors={rpColors}
                      status={rp.status}
                      created_at={rp.created_at}
                      free_shipping={rp.free_shipping}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <PackageOpen className="h-12 w-12 mb-3" strokeWidth={1.5} />
                <p className="text-sm">관련 상품이 없습니다</p>
              </div>
            )}
          </TabsContent>

          {/* 구매후기 */}
          <TabsContent value="reviews" className="mt-6">
            {user && writableOrderItem && (
              <div className="flex justify-end mb-4">
                <Link
                  href={`/mypage/reviews/write/${writableOrderItem.id}`}
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline"
                >
                  <Pencil size={14} strokeWidth={1.5} />
                  이 상품 리뷰 쓰기
                </Link>
              </div>
            )}
            {typedReviews.length > 0 ? (
              <ProductReviews
                reviews={typedReviews}
                averageRating={averageRating}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium">아직 구매후기가 없습니다</p>
                <p className="text-xs mt-1">첫 번째 후기를 남겨주세요!</p>
              </div>
            )}
          </TabsContent>

          {/* 상품문의 */}
          {/* P2: qna 테이블 생성 후 실제 CRUD 구현 */}
          <TabsContent value="qna" className="mt-6">
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium">상품문의가 없습니다</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <a href="#">카카오톡으로 문의하기</a>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 쇼핑가이드 — 별도 섹션 */}
      <section className="mt-12 border-t bg-muted/30 -mx-4 md:-mx-8 px-4 md:px-8 py-8">
        <h2 className="text-lg font-bold mb-4">쇼핑가이드</h2>
        <Accordion type="single" collapsible defaultValue="item-0">
          {SHOPPING_GUIDE.map((section, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger className="text-sm font-bold hover:no-underline">
                {section.title}
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}

export default ProductDetailPage
