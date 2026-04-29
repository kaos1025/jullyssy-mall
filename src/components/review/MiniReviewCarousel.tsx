"use client"

import Image from "next/image"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewWithImages } from "@/types"

interface MiniReviewCarouselProps {
  reviews: ReviewWithImages[]
  reviewsTabHref?: string
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5" aria-label={`별점 ${rating}점`}>
    {Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3 w-3",
          i < rating
            ? "fill-yellow-400 text-yellow-400"
            : "fill-muted text-muted"
        )}
        aria-hidden
      />
    ))}
  </div>
)

const MiniReviewCard = ({ review }: { review: ReviewWithImages }) => {
  const thumb = review.images?.[0]
  const writerName = review.user?.name?.trim()
    ? `${review.user.name.trim()[0]}**`
    : "익명"

  return (
    <article className="flex-shrink-0 w-[40vw] sm:w-[180px] md:w-[200px] rounded-lg overflow-hidden bg-white border border-gray-100">
      {thumb ? (
        <div className="relative aspect-square bg-gray-100">
          <Image
            src={thumb.url}
            alt={`${writerName}님 리뷰 이미지`}
            fill
            sizes="(max-width: 640px) 40vw, 200px"
            className="object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-square bg-subtle flex items-center justify-center px-3">
          <p className="text-xs text-gray-700 line-clamp-4 text-center leading-snug">
            {review.content || "리뷰 내용 준비 중"}
          </p>
        </div>
      )}

      <div className="p-2.5">
        <StarRow rating={review.rating} />
        {thumb && review.content && (
          <p className="mt-1.5 text-xs text-gray-700 line-clamp-2 leading-snug">
            {review.content}
          </p>
        )}
        <div className="mt-1.5 flex justify-between items-center text-[10px] text-gray-400">
          <span>{writerName}</span>
          <time dateTime={review.created_at}>
            {formatDate(review.created_at)}
          </time>
        </div>
      </div>
    </article>
  )
}

const MiniReviewCarousel = ({
  reviews,
  reviewsTabHref = "#reviews",
}: MiniReviewCarouselProps) => {
  if (reviews.length === 0) return null

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetId = reviewsTabHref.replace(/^#/, "")
    const target = document.getElementById(targetId)
    if (target) {
      e.preventDefault()
      target.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section aria-labelledby="review-mini-title" className="my-8">
      <header className="mb-3 flex items-baseline justify-between px-4 sm:px-0">
        <div>
          <p className="text-xs tracking-wider text-gray-500 uppercase">
            Review
          </p>
          <h2
            id="review-mini-title"
            className="text-base font-semibold mt-0.5"
          >
            구매자 후기
          </h2>
        </div>
        <a
          href={reviewsTabHref}
          onClick={handleSmoothScroll}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          전체보기 →
        </a>
      </header>

      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1 px-4 sm:px-0 -mx-4 sm:mx-0">
        {reviews.map((review) => (
          <MiniReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  )
}

export default MiniReviewCarousel
