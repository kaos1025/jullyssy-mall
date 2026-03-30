import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
  const supabase = createClient()
  const { data: product } = await supabase
    .from("products")
    .select("name, description")
    .eq("id", params.id)
    .single()

  if (!product) return { title: "상품을 찾을 수 없습니다" }

  return {
    title: `${product.name} | 쥴리씨`,
    description: product.description?.slice(0, 160) || product.name,
  }
}

const ProductDetailPage = async ({ params }: ProductDetailPageProps) => {
  const supabase = createClient()

  // 상품 + 이미지 + 옵션 조회
  const { data: product } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories(*),
      product_images(*),
      product_options(*)
    `
    )
    .eq("id", params.id)
    .eq("status", "ACTIVE")
    .single()

  if (!product) notFound()

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
    .eq("product_id", params.id)
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
    <div className="container py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 좌측: 이미지 갤러리 */}
        <ImageGallery images={images} />

        {/* 우측: 상품 정보 */}
        <div className="space-y-4">
          {/* 카테고리 */}
          {product.category && (
            <p className="text-sm text-muted-foreground">
              {product.category.name}
            </p>
          )}

          {/* 상품명 */}
          <h1 className="text-xl md:text-2xl font-bold">{product.name}</h1>

          {/* 가격 */}
          <div className="flex items-baseline gap-3">
            {discountRate > 0 && (
              <Badge variant="destructive" className="text-sm">
                {discountRate}%
              </Badge>
            )}
            {product.sale_price && (
              <span className="text-lg text-muted-foreground line-through">
                {product.price.toLocaleString()}원
              </span>
            )}
            <span className="text-2xl font-bold">
              {(product.sale_price ?? product.price).toLocaleString()}원
            </span>
          </div>

          <Separator />

          {/* 상품 기본 정보 */}
          <div className="space-y-2 text-sm">
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

          <Separator />

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

      {/* 탭: 상세설명 / 리뷰 */}
      <div className="mt-12">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="description" className="flex-1 md:flex-none">
              상세설명
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 md:flex-none">
              리뷰 ({typedReviews.length})
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
        </Tabs>
      </div>
    </div>
  )
}

export default ProductDetailPage
