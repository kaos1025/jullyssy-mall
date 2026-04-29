import { Skeleton } from "@/components/ui/skeleton"

const ProductCardSkeleton = () => {
  return (
    <div className="group">
      {/* 이미지 — ProductCard와 동일 비율/라운딩 */}
      <Skeleton className="aspect-[3/4] w-full rounded-lg" />

      {/* 정보 영역 — ProductCard mt-2.5 min-h-[90px] 와 정확히 일치 */}
      <div className="mt-2.5 flex flex-col gap-1.5 min-h-[90px]">
        {/* 가격 */}
        <Skeleton className="h-4 w-1/3" />
        {/* 상품명 2줄 */}
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        {/* 컬러칩 — mt-auto 로 하단 고정, 카드 높이 일정 유지 */}
        <div className="flex gap-1 mt-auto">
          <Skeleton className="h-[10px] w-[10px] rounded-full" />
          <Skeleton className="h-[10px] w-[10px] rounded-full" />
          <Skeleton className="h-[10px] w-[10px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export { ProductCardSkeleton, ProductGridSkeleton }
