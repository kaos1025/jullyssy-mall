"use client"

import { Star } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"
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
            <div key={review.id} className="py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} />
                  <span className="text-sm font-medium">
                    {review.user?.name || "익명"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>

              {/* 키/몸무게/사이즈 */}
              {(review.height || review.weight || review.purchased_size) && (
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {review.height && <span>키 {review.height}cm</span>}
                  {review.weight && <span>몸무게 {review.weight}kg</span>}
                  {review.purchased_size && (
                    <span>구매사이즈 {review.purchased_size}</span>
                  )}
                </div>
              )}

              {review.content && (
                <p className="text-sm leading-relaxed">{review.content}</p>
              )}

              {/* 리뷰 이미지 */}
              {review.images.length > 0 && (
                <div className="flex gap-2">
                  {review.images.map((img) => (
                    <div
                      key={img.id}
                      className="relative h-20 w-20 overflow-hidden rounded-md"
                    >
                      <Image
                        src={img.url}
                        alt={`${review.user?.name || "고객"}님의 리뷰 이미지`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
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
