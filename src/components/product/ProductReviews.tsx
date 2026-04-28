"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import ReviewCard from "@/components/review/ReviewCard"
import type { ReviewWithImages } from "@/types"

interface ProductReviewsProps {
  reviews: ReviewWithImages[]
  averageRating: number
}

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3.5 w-3.5",
          i < rating
            ? "fill-yellow-400 text-yellow-400"
            : "fill-muted text-muted"
        )}
      />
    ))}
  </div>
)

const ProductReviews = ({ reviews, averageRating }: ProductReviewsProps) => {
  // 별점 분포
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))

  return (
    <div className="space-y-6">
      {/* 별점 평균 */}
      <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
        <div className="text-center">
          <p className="text-3xl font-bold">{averageRating.toFixed(1)}</p>
          <StarRating rating={Math.round(averageRating)} />
          <p className="text-xs text-muted-foreground mt-1">
            {reviews.length}개 리뷰
          </p>
        </div>
        <div className="flex-1 space-y-1">
          {distribution.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-3">{star}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full"
                  style={{
                    width:
                      reviews.length > 0
                        ? `${(count / reviews.length) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="w-6 text-right text-muted-foreground">
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 리뷰 리스트 */}
      {reviews.length > 0 ? (
        <div className="divide-y">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <p className="text-center py-10 text-muted-foreground">
          아직 리뷰가 없습니다.
        </p>
      )}
    </div>
  )
}

export default ProductReviews
