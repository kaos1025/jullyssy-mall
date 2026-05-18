import { Skeleton } from "@/components/ui/skeleton"

const ProductDetailLoading = () => {
  return (
    <div className="container py-4 md:py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
        {/* 좌: 이미지 갤러리 */}
        <div className="w-full md:max-w-[600px] space-y-3">
          {/* 메인 이미지 — aspect 3:4 */}
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />

          {/* 썸네일 row — h-16 w-16 (실 갤러리와 동일) */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-md shrink-0" />
            ))}
          </div>
        </div>

        {/* 우: 상품 정보 + 옵션 */}
        <div className="space-y-4">
          {/* breadcrumb + ShareButton (size=icon, h-10 w-10) */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>

          {/* 상품명 — 1줄 (실 페이지 min-h 없음 → 동기화) */}
          <Skeleton className="h-5 w-4/5" />

          {/* 가격 — 할인율(text-xl) + 가격/원가 row */}
          <div className="space-y-1">
            <Skeleton className="h-7 w-12" />
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>

          {/* 옵션 영역 (border-t pt-4 + space-y-5) */}
          <div className="border-t pt-4 space-y-5">
            {/* 컬러 옵션 — 라벨 + 칩 3개 (하한값) */}
            <div>
              <Skeleton className="h-4 w-12 mb-3" />
              <div className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>

            {/* PC 인라인 버튼 — 40:60 비율 (h-11 = lg size) */}
            <div className="hidden md:flex gap-3">
              <Skeleton className="h-11 w-[40%] rounded-md" />
              <Skeleton className="h-11 w-[60%] rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* 탭 영역 — 헤더만 (4탭, border-b, py-3) */}
      <div className="mt-12">
        <div className="grid grid-cols-4 w-full border-b border-gray-200">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-center py-3">
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* 모바일 하단 고정 바 — 구매하기 (MobileNav 60px 위) */}
      <div className="fixed bottom-[60px] left-0 right-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)]">
        <Skeleton className="h-12 w-full rounded-none" />
      </div>
    </div>
  )
}

export default ProductDetailLoading
