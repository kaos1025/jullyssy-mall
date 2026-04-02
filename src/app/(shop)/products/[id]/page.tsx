import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import ImageGallery from "@/components/product/ImageGallery"
import ProductOptions from "@/components/product/ProductOptions"
import ProductReviews from "@/components/product/ProductReviews"
import type { Metadata } from "next"
import type { ReviewWithImages } from "@/types"

interface ProductDetailPageProps {
  params: { id: string }
}

export const generateMetadata = async ({
  params,
}: ProductDetailPageProps): Promise<Metadata> => {
  const supabase = await createClient()
  const { data: product } = await supabase
    .from("products")
    .select("name, description")
    .or(`slug.eq.${params.id},id.eq.${params.id}`)
    .single()

  if (!product) return { title: "상품을 찾을 수 없습니다" }

  return {
    title: `${product.name} | 쥴리씨`,
    description: product.description?.slice(0, 160) || product.name,
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

  return (
    <div className="container py-4 md:py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        {/* 좌측: 이미지 갤러리 */}
        <ImageGallery images={images} />

        {/* 우측: 상품 정보 + 옵션 */}
        <div className="md:sticky md:top-20 md:self-start space-y-4">
          {/* 카테고리 breadcrumb */}
          {product.category && (
            <p className="text-xs text-muted-foreground">
              {parentCategory
                ? `${parentCategory.name} > ${product.category.name}`
                : product.category.name}
            </p>
          )}

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

      {/* 탭: 상세설명 / 리뷰 / 배송·교환 */}
      <div className="mt-12" id="reviews">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="description" className="flex-1 md:flex-none">
              상세설명
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 md:flex-none">
              리뷰 ({typedReviews.length})
            </TabsTrigger>
            <TabsTrigger value="shipping" className="flex-1 md:flex-none">
              배송/교환
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-6">
            {product.description ? (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="text-center py-10 text-muted-foreground">
                상세설명이 없습니다.
              </p>
            )}
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <ProductReviews
              reviews={typedReviews}
              averageRating={averageRating}
            />
          </TabsContent>
          <TabsContent value="shipping" className="mt-6">
            <div className="space-y-6 text-sm leading-relaxed">
              <div>
                <h3 className="font-bold mb-2">배송 안내</h3>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li>배송비: 3,000원 (5만원 이상 구매 시 무료배송)</li>
                  <li>배송 기간: 결제 완료 후 1~3 영업일 이내 출고</li>
                  <li>도서산간 지역은 추가 배송비가 발생할 수 있습니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold mb-2">교환/반품 안내</h3>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li>상품 수령 후 7일 이내 교환/반품 신청 가능</li>
                  <li>고객 변심에 의한 교환/반품 시 배송비 고객 부담</li>
                  <li>상품 하자 시 무료 교환/반품 가능</li>
                  <li>착용하거나 세탁한 상품, 택을 제거한 상품은 교환/반품 불가</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default ProductDetailPage
