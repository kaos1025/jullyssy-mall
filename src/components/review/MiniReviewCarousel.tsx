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

const MiniCard = ({ review }: { review: ReviewWithImages }) => {
  const cover = review.images?.[0]?.url
  const writerName = review.user?.name?.trim() || "익명"
  const masked =
    writerName.length > 1
      ? `${writerName[0]}${"*".repeat(Math.max(1, writerName.length - 1))}`
      : writerName

  return (
    <a
      href="#reviews"
      className={cn(
        "group block w-[160px] shrink-0 md:w-auto",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={`${masked}님 리뷰 이미지`}
            fill
            sizes="(min-width: 768px) 22vw, 160px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-warm p-3 text-center">
            <p className="line-clamp-5 text-xs leading-relaxed text-foreground/80">
              {review.content || "리뷰 내용 준비 중"}
            </p>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <StarRow rating={review.rating} />
          <span className="text-[10px] text-muted-foreground">
            {formatDate(review.created_at)}
          </span>
        </div>
        {cover && review.content && (
          <p className="line-clamp-2 text-xs text-foreground/80">
            {review.content}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">{masked}</p>
      </div>
    </a>
  )
}

const MiniReviewCarousel = ({
  reviews,
  reviewsTabHref = "#reviews",
}: MiniReviewCarouselProps) => {
  if (reviews.length === 0) return null

  return (
    <section aria-labelledby="review-mini-title" className="mt-10">
      <header className="mb-3 flex items-baseline justify-between">
        <div className="space-y-1">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Review
          </p>
          <h2 id="review-mini-title" className="text-base font-bold md:text-lg">
            구매자 후기
          </h2>
        </div>
        <a
          href={reviewsTabHref}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          전체보기
        </a>
      </header>

      <div
        className={cn(
          "scrollbar-hide flex gap-3 overflow-x-auto pb-1 -mx-4 px-4",
          "md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0"
        )}
      >
        {reviews.map((review) => (
          <MiniCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  )
}

export default MiniReviewCarousel
