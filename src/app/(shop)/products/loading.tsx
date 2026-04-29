import { Skeleton } from "@/components/ui/skeleton"
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton"

const ProductsLoading = () => {
  return (
    <div className="container py-6">
      {/* 카테고리/제목 (h1 text-xl) */}
      <Skeleton className="h-7 w-32 mb-4" />

      {/* ProductListFilter — 카테고리 pill + 정렬 select */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* 카테고리 pill */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide md:flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-16 rounded-full shrink-0"
              />
            ))}
          </div>
          {/* 정렬 select */}
          <Skeleton className="h-9 w-[130px] shrink-0" />
        </div>
      </div>

      {/* 상품 수 */}
      <Skeleton className="h-4 w-24 mt-4 mb-4" />

      {/* 상품 그리드 */}
      <ProductGridSkeleton count={12} />
    </div>
  )
}

export default ProductsLoading
