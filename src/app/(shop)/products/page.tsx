import Link from "next/link"
import { PackageOpen, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import ProductCard from "@/components/product/ProductCard"
import ProductListFilter from "@/components/product/ProductListFilter"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

interface ProductsPageProps {
  searchParams: {
    category?: string
    sort?: string
    page?: string
  }
}

export const generateMetadata = async ({
  searchParams,
}: ProductsPageProps): Promise<Metadata> => {
  const category = searchParams.category

  if (category) {
    try {
      const supabase = await createClient()
      const { data: cat } = await supabase
        .from("categories")
        .select("name")
        .eq("slug", category)
        .single()

      if (cat) {
        return {
          title: `${cat.name} - 여성의류`,
          description: `쥴리씨의 트렌디한 ${cat.name} 컬렉션. 다양한 스타일의 ${cat.name}를 만나보세요.`,
          alternates: { canonical: `/products?category=${category}` },
        }
      }
    } catch {
      // 조회 실패 시 기본값 사용
    }
  }

  return {
    title: "전체 상품",
    description:
      "쥴리씨의 트렌디한 여성의류를 만나보세요. 신상품부터 베스트셀러까지.",
    alternates: {
      canonical: category ? `/products?category=${category}` : "/products",
    },
  }
}

const ProductsPage = async ({ searchParams }: ProductsPageProps) => {
  const supabase = await createClient()
  const page = Number(searchParams.page) || 1
  const pageSize = 20
  const offset = (page - 1) * pageSize

  // 1depth 카테고리 목록 조회
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("sort_order")

  // 서브카테고리 조회: 선택된 카테고리의 children
  let subCategories: typeof categories = []
  let selectedParentId: string | null = null
  let categoryName: string | null = null

  if (searchParams.category && categories) {
    // 선택된 slug가 1depth인지 확인
    const parentCat = categories.find((c) => c.slug === searchParams.category)
    if (parentCat) {
      selectedParentId = parentCat.id
      categoryName = parentCat.name
    } else {
      // 2depth slug일 수 있음 → 부모를 찾기
      const { data: subCat } = await supabase
        .from("categories")
        .select("name, parent_id")
        .eq("slug", searchParams.category)
        .single()
      if (subCat?.parent_id) {
        selectedParentId = subCat.parent_id
        categoryName = subCat.name
      }
    }

    if (selectedParentId) {
      const { data: subs } = await supabase
        .from("categories")
        .select("*")
        .eq("parent_id", selectedParentId)
        .order("sort_order")
      subCategories = subs || []
    }
  }

  // 상품 쿼리 빌드
  let query = supabase
    .from("products")
    .select(
      `
      *,
      product_images(url, is_thumbnail, sort_order),
      product_options(color),
      reviews(id)
    `,
      { count: "exact" }
    )
    .eq("status", "ACTIVE")

  // 카테고리 필터
  if (searchParams.category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", searchParams.category)
      .single()

    if (cat) {
      const { data: childCats } = await supabase
        .from("categories")
        .select("id")
        .eq("parent_id", cat.id)

      const categoryIds = [cat.id, ...(childCats?.map((c) => c.id) || [])]
      query = query.in("category_id", categoryIds)
    }
  }

  // 정렬
  switch (searchParams.sort) {
    case "price_asc":
      query = query.order("sale_price", { ascending: true, nullsFirst: false })
                   .order("price", { ascending: true })
      break
    case "price_desc":
      query = query.order("sale_price", { ascending: false, nullsFirst: true })
                   .order("price", { ascending: false })
      break
    case "popular":
      query = query.order("sell_count", { ascending: false })
      break
    default:
      query = query.order("created_at", { ascending: false })
  }

  const { data: products, count } = await query.range(offset, offset + pageSize - 1)

  const totalCount = count || 0
  const hasNextPage = offset + pageSize < totalCount

  // 다음 페이지 URL 생성
  const nextPageParams = new URLSearchParams()
  if (searchParams.category) nextPageParams.set("category", searchParams.category)
  if (searchParams.sort) nextPageParams.set("sort", searchParams.sort)
  nextPageParams.set("page", String(page + 1))

  return (
    <div className="container py-6">
      <h1 className="text-xl font-bold mb-4">
        {categoryName || "전체 상품"}
      </h1>

      <ProductListFilter
        categories={categories || []}
        subCategories={subCategories || []}
        currentCategory={searchParams.category}
        currentSort={searchParams.sort}
      />

      {/* 상품 수 */}
      <p className="text-sm text-muted-foreground mt-4 mb-4">
        전체 {totalCount.toLocaleString()}개
      </p>

      {products && products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                sale_price={product.sale_price}
                thumbnail={
                  product.product_images?.find((img: { is_thumbnail: boolean }) => img.is_thumbnail)?.url
                  || product.product_images?.[0]?.url
                  || null
                }
                images={
                  (product.product_images ?? [])
                    .sort((a: { sort_order?: number }, b: { sort_order?: number }) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((img: { url: string }) => img.url)
                }
                colors={Array.from(new Set((product.product_options ?? []).map((o: { color: string }) => o.color)))}
                review_count={product.reviews?.length || 0}
                status={product.status}
                created_at={product.created_at}
              />
            ))}
          </div>

          {/* 다음 페이지 */}
          {hasNextPage && (
            <div className="flex justify-center mt-10">
              <Button variant="outline" size="lg" asChild>
                <Link href={`/products?${nextPageParams.toString()}`}>
                  다음 페이지 <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <PackageOpen className="h-12 w-12 mb-4" strokeWidth={1.5} />
          <p className="text-sm">상품 준비 중입니다</p>
        </div>
      )}
    </div>
  )
}

export default ProductsPage
