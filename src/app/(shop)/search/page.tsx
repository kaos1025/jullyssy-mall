import Link from "next/link"
import { PackageOpen, Search, ChevronRight } from "lucide-react"
import ProductCard from "@/components/product/ProductCard"
import { Button } from "@/components/ui/button"
import { getSearchResults, PRODUCT_SORTS, type ProductSort } from "@/lib/products"
import type { Metadata } from "next"

interface SearchPageProps {
  searchParams: {
    q?: string
    sort?: string
    page?: string
  }
}

export const generateMetadata = async ({
  searchParams,
}: SearchPageProps): Promise<Metadata> => {
  const q = searchParams.q?.trim()
  return {
    title: q ? `"${q}" 검색 결과` : "검색",
    description: q
      ? `쥴리씨에서 "${q}" 검색 결과를 확인하세요.`
      : "쥴리씨에서 원하는 상품을 검색해보세요.",
    // 검색 결과 페이지는 색인 제외(무한 q 조합 색인 방지). canonical은 q 없는 /search.
    robots: { index: false, follow: true },
    alternates: { canonical: "/search" },
  }
}

const SearchPage = async ({ searchParams }: SearchPageProps) => {
  const q = (searchParams.q ?? "").trim()
  const page = Number(searchParams.page) || 1
  const pageSize = 20
  const offset = (page - 1) * pageSize

  // sort 정규화 (무효/미지정 → latest) — 캐시 키 안정화.
  const sort: ProductSort = PRODUCT_SORTS.includes(searchParams.sort as ProductSort)
    ? (searchParams.sort as ProductSort)
    : "latest"

  // 빈 검색어는 DB 조회 없이 안내만 (prefetch /search 무q도 경량 처리).
  const { products, totalCount } = q
    ? await getSearchResults(q, sort, offset, pageSize)
    : { products: [], totalCount: 0 }

  const hasNextPage = offset + pageSize < totalCount

  const nextPageParams = new URLSearchParams()
  nextPageParams.set("q", q)
  if (searchParams.sort) nextPageParams.set("sort", searchParams.sort)
  nextPageParams.set("page", String(page + 1))

  return (
    <div className="container py-6">
      <h1 className="text-xl font-bold mb-4">
        {q ? <>&ldquo;{q}&rdquo; 검색 결과</> : "검색"}
      </h1>

      {!q ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Search className="h-12 w-12 mb-4" strokeWidth={1.5} />
          <p className="text-sm">검색어를 입력해주세요</p>
        </div>
      ) : products.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            전체 {totalCount.toLocaleString()}개
          </p>
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
                  product.product_images?.find((img) => img.is_thumbnail)?.url ||
                  product.product_images?.[0]?.url ||
                  null
                }
                images={
                  (product.product_images ?? [])
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((img) => img.url)
                }
                colors={Array.from(
                  new Set((product.product_options ?? []).map((o) => o.color)),
                )}
                review_count={product.reviews?.[0]?.count ?? 0}
                status={product.status}
                created_at={product.created_at}
                free_shipping={product.free_shipping}
              />
            ))}
          </div>

          {hasNextPage && (
            <div className="flex justify-center mt-10">
              <Button variant="outline" size="lg" asChild>
                <Link href={`/search?${nextPageParams.toString()}`}>
                  다음 페이지 <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <PackageOpen className="h-12 w-12 mb-4" strokeWidth={1.5} />
          <p className="text-sm">
            &ldquo;{q}&rdquo;에 대한 검색 결과가 없습니다
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/products">전체 상품 보기</Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export default SearchPage
