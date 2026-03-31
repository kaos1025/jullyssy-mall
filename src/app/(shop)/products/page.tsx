import { createClient } from "@/lib/supabase/server"
import ProductCard from "@/components/product/ProductCard"
import ProductListFilter from "@/components/product/ProductListFilter"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "상품 목록 | 쥴리씨",
  description: "쥴리씨의 트렌디한 여성의류를 만나보세요.",
}

interface ProductsPageProps {
  searchParams: {
    category?: string
    sort?: string
    page?: string
  }
}

const ProductsPage = async ({ searchParams }: ProductsPageProps) => {
  const supabase = await createClient()
  const page = Number(searchParams.page) || 1
  const pageSize = 20
  const offset = (page - 1) * pageSize

  // 카테고리 목록 조회
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .is("parent_id", null)
    .order("sort_order")

  // 상품 쿼리 빌드
  let query = supabase
    .from("products")
    .select(
      `
      *,
      product_images!inner(url, is_thumbnail),
      reviews(id)
    `,
      { count: "exact" }
    )
    .eq("status", "ACTIVE")
    .eq("product_images.is_thumbnail", true)

  // 카테고리 필터
  if (searchParams.category) {
    // 슬러그로 카테고리 ID 찾기 (부모 + 자식 모두 포함)
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

  const totalPages = Math.ceil((count || 0) / pageSize)

  return (
    <div className="container py-6">
      <ProductListFilter
        categories={categories || []}
        currentCategory={searchParams.category}
        currentSort={searchParams.sort}
      />

      {products && products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                sale_price={product.sale_price}
                thumbnail={
                  product.product_images?.[0]?.url || null
                }
                review_count={product.reviews?.length || 0}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (p) => (
                  <a
                    key={p}
                    href={`/products?${new URLSearchParams({
                      ...(searchParams.category
                        ? { category: searchParams.category }
                        : {}),
                      ...(searchParams.sort
                        ? { sort: searchParams.sort }
                        : {}),
                      page: String(p),
                    }).toString()}`}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "border hover:bg-muted"
                    }`}
                  >
                    {p}
                  </a>
                )
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          상품이 없습니다.
        </div>
      )}
    </div>
  )
}

export default ProductsPage
