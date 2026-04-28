import Image from "next/image"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewWithImages } from "@/types"
import { REVIEW_TAG_AXIS_LABELS } from "@/types/review"

interface ReviewCardProps {
  review: ReviewWithImages
}

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5" aria-label={`별점 ${rating}점`}>
    {Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-3.5 w-3.5",
          i < rating
            ? "fill-yellow-400 text-yellow-400"
            : "fill-muted text-muted"
        )}
        aria-hidden
      />
    ))}
  </div>
)

const TagPill = ({ axis, value }: { axis: string; value: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground/80">
    <span className="text-muted-foreground">{axis}</span>
    <span className="font-medium">{value}</span>
  </span>
)

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

const ReviewCard = ({ review }: ReviewCardProps) => {
  const writerName = review.user?.name?.trim() || "익명"
  const masked =
    writerName.length > 1
      ? `${writerName[0]}${"*".repeat(Math.max(1, writerName.length - 1))}`
      : writerName

  const tags: { axis: string; value: string }[] = []
  if (review.tag_size)
    tags.push({ axis: REVIEW_TAG_AXIS_LABELS.size, value: review.tag_size })
  if (review.tag_color)
    tags.push({ axis: REVIEW_TAG_AXIS_LABELS.color, value: review.tag_color })
  if (review.tag_thickness)
    tags.push({
      axis: REVIEW_TAG_AXIS_LABELS.thickness,
      value: review.tag_thickness,
    })
  if (review.tag_stretch)
    tags.push({
      axis: REVIEW_TAG_AXIS_LABELS.stretch,
      value: review.tag_stretch,
    })

  return (
    <article className="space-y-3 py-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarRow rating={review.rating} />
          <span className="text-sm font-medium">{masked}</span>
        </div>
        <time
          className="text-xs text-muted-foreground"
          dateTime={review.created_at}
        >
          {formatDate(review.created_at)}
        </time>
      </header>

      {(review.height || review.weight || review.purchased_size) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {review.height && <span>키 {review.height}cm</span>}
          {review.weight && <span>몸무게 {review.weight}kg</span>}
          {review.purchased_size && <span>구매 사이즈 {review.purchased_size}</span>}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagPill key={t.axis} axis={t.axis} value={t.value} />
          ))}
        </div>
      )}

      {review.content && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
          {review.content}
        </p>
      )}

      {review.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.images.map((img) => (
            <div
              key={img.id}
              className="relative h-20 w-20 overflow-hidden rounded-md bg-muted md:h-24 md:w-24"
            >
              <Image
                src={img.url}
                alt={`${masked}님 리뷰 이미지`}
                fill
                sizes="(min-width: 768px) 96px, 80px"
                className="object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export default ReviewCard
