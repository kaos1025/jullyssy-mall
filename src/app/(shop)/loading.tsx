import { Skeleton } from "@/components/ui/skeleton"
import { ProductGridSkeleton } from "@/components/product/ProductCardSkeleton"

const HomeLoading = () => {
  return (
    <div>
      {/* 히어로 — h-hero-m / h-hero-d 토큰 사용 */}
      <Skeleton className="h-hero-m md:h-hero-d w-full rounded-none" />

      {/* 카테고리 pill — 모바일 좌측 / PC 중앙 정렬 */}
      <section className="py-8 md:py-10">
        <div className="container">
          <div className="flex md:justify-center gap-2 overflow-x-auto scrollbar-hide">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-9 w-20 rounded-full shrink-0"
              />
            ))}
          </div>
        </div>
      </section>

      {/* NEW ARRIVAL */}
      <section className="py-16">
        <div className="container">
          <div className="flex items-end justify-between mb-8 md:mb-10">
            <div>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <ProductGridSkeleton count={8} />
        </div>
      </section>

      {/* WEEKLY BEST — bg-subtle 풀폭 배경 */}
      <section className="py-16 bg-subtle">
        <div className="container">
          <div className="flex items-end justify-between mb-8 md:mb-10">
            <div>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <ProductGridSkeleton count={8} />
        </div>
      </section>

      {/* 프로모션 배너 섹션은 의도적 미포함 (Track C 작업 대기 + viewport 밖) */}
    </div>
  )
}

export default HomeLoading
