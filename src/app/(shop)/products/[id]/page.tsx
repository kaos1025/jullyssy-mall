import { notFound } from "next/navigation"
import { PackageOpen, MessageSquare, HelpCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
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
import { SHOPPING_GUIDE } from "@/constants/shopping-guide"
import type { Metadata } from "next"
import type { ReviewWithImages } from "@/types"

interface ProductDetailPageProps {
  params: { id: string }
}

export const generateMetadata = async ({
  params,
}: ProductDetailPageProps): Promise<Metadata> => {
  try {
    const supabase = await createClient()
    const { data: product } = await supabase
      .from("products")
      .select("id, slug, name, description, price, sale_price, search_tags, product_images(url, is_thumbnail)")
      .or(`slug.eq.${params.id},id.eq.${params.id}`)
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
        description: product.description?.slice(0, 160) || product.name,
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

  // 상품 + 이미지 + 옵션 조회
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
    .or(`slug.eq.${params.id},id.eq.${params.id}`)
    .eq("status", "ACTIVE")
    .single()

  if (!product) notFound()

  // 부모 카테고리 조회
  let parentCategory: { name: string; slug: string } | null = null
  if (product.category?.parent_id) {
    const { data } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("id", product.category.parent_id)
      .single()
    parentCategory = data
  }

  // 리뷰 조회
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
      *,
      images:review_images(*),
      user:profiles(name, height, weight)
    `
    )
    .eq("product_id", product.id)
    .order("created_at", { ascending: false })

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
    description: product.description
      ? product.description
          .replace(/<[^>]*>/g, "")
          .replace(/\|/g, "")
          .replace(/[\n\r\t]+/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim()
          .slice(0, 200)
      : "",
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
      seller: { "@type": "Organization", name: "쥴리씨" },
      url: `${SITE_URL}/products/${product.slug || product.id}`,
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
              options={product.product_options || []}
            />
          </div>
        </div>
      </div>

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
