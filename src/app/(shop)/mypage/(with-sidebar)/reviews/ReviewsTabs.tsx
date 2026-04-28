"use client"

import Image from "next/image"
import Link from "next/link"
import { Star, MessageSquarePlus, Inbox } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { REVIEW_TAG_AXIS_LABELS } from "@/types/review"
import type {
  ReviewTagSize,
  ReviewTagColor,
  ReviewTagThickness,
  ReviewTagStretch,
} from "@/types"

export interface WritableItem {
  id: string
  product_id: string
  product_name: string
  product_image: string | null
  color: string
  size: string
  quantity: number
  is_reviewed: boolean
  orders: {
    id: string
    order_no: string
    status: string
    user_id: string
    created_at: string
  }
  products: {
    id: string
    product_images: {
      url: string
      is_thumbnail: boolean
      sort_order: number
    }[]
  } | null
}

export interface MyReview {
  id: string
  product_id: string
  order_item_id: string | null
  rating: number
  content: string | null
  height: number | null
  weight: number | null
  purchased_size: string | null
  tag_size: ReviewTagSize | null
  tag_color: ReviewTagColor | null
  tag_thickness: ReviewTagThickness | null
  tag_stretch: ReviewTagStretch | null
  created_at: string
  products: {
    id: string
    slug: string | null
    name: string
    product_images: {
      url: string
      is_thumbnail: boolean
      sort_order: number
    }[]
  } | null
  order_items: { color: string; size: string } | null
  review_images: { url: string; sort_order: number }[]
}

interface ReviewsTabsProps {
  writableItems: WritableItem[]
  myReviews: MyReview[]
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

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

const pickThumb = (
  images:
    | { url: string; is_thumbnail: boolean; sort_order: number }[]
    | undefined
) => {
  if (!images?.length) return null
  return (
    images.find((i) => i.is_thumbnail) ??
    [...images].sort((a, b) => a.sort_order - b.sort_order)[0]
  )
}

const buildTags = (review: MyReview) => {
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
  return tags
}

interface EmptyProps {
  icon: typeof Inbox
  message: string
  sub: string
}

const Empty = ({ icon: Icon, message, sub }: EmptyProps) => (
  <div className="text-center py-20 text-muted-foreground">
    <Icon className="h-10 w-10 mx-auto mb-3 opacity-60" aria-hidden />
    <p className="text-sm font-medium">{message}</p>
    <p className="mt-1 text-xs">{sub}</p>
  </div>
)

const MyReviewCard = ({ review }: { review: MyReview }) => {
  const product = review.products
  const productHref = `/products/${product?.slug ?? product?.id ?? review.product_id}`
  const thumb = pickThumb(product?.product_images)
  const tags = buildTags(review)
  const meta = [
    review.height && `키 ${review.height}cm`,
    review.weight && `몸무게 ${review.weight}kg`,
    review.purchased_size && `구매 사이즈 ${review.purchased_size}`,
  ].filter(Boolean) as string[]
  const sortedImages = [...review.review_images].sort(
    (a, b) => a.sort_order - b.sort_order
  )
  const optionText = review.order_items
    ? `${review.order_items.color} / ${review.order_items.size}`
    : null

  return (
    <li className="border rounded-lg p-4 space-y-3">
      <Link
        href={productHref}
        className="flex gap-3 items-center hover:opacity-80 transition"
      >
        <div className="relative w-[60px] h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 self-start">
          {thumb && (
            <Image
              src={thumb.url}
              alt={product?.name ?? "상품"}
              fill
              sizes="60px"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">
            {product?.name ?? "상품"}
          </p>
          {optionText && (
            <p className="text-xs text-gray-500 mt-0.5">{optionText}</p>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between">
        <StarRow rating={review.rating} />
        <time
          dateTime={review.created_at}
          className="text-xs text-muted-foreground"
        >
          {formatDate(review.created_at)}
        </time>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t.axis}
              className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full"
            >
              {t.axis} — {t.value}
            </span>
          ))}
        </div>
      )}

      {review.content && (
        <p className="text-sm whitespace-pre-wrap line-clamp-4">
          {review.content}
        </p>
      )}

      {sortedImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sortedImages.map((img, i) => (
            <div
              key={i}
              className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted"
            >
              <Image
                src={img.url}
                alt={`리뷰 이미지 ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {meta.length > 0 && (
        <p className="text-xs text-gray-500">{meta.join(" · ")}</p>
      )}
    </li>
  )
}

const ReviewsTabs = ({ writableItems, myReviews }: ReviewsTabsProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? "writable"

  const handleChange = (v: string) => {
    router.push(`/mypage/reviews?tab=${v}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">리뷰 관리</h2>

      <Tabs value={tab} onValueChange={handleChange}>
        <TabsList>
          <TabsTrigger value="writable">
            리뷰 작성 ({writableItems.length})
          </TabsTrigger>
          <TabsTrigger value="written">
            작성한 리뷰 ({myReviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="writable" className="mt-4">
          {writableItems.length === 0 ? (
            <Empty
              icon={MessageSquarePlus}
              message="작성 가능한 리뷰가 없습니다"
              sub="구매확정 상태의 주문이 있어야 리뷰를 작성할 수 있어요"
            />
          ) : (
            <ul className="space-y-3">
              {writableItems.map((item) => {
                const thumb = pickThumb(item.products?.product_images)
                const thumbUrl = thumb?.url ?? item.product_image
                return (
                  <li
                    key={item.id}
                    className="flex gap-4 p-4 border rounded-lg"
                  >
                    <div className="relative w-20 h-[107px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 self-start">
                      {thumbUrl && (
                        <Image
                          src={thumbUrl}
                          alt={item.product_name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-xs text-gray-500 truncate">
                          주문 {item.orders.order_no}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(item.orders.created_at)}
                        </p>
                      </div>
                      <p className="mt-1 text-sm line-clamp-2 font-medium">
                        {item.product_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.color} / {item.size}
                      </p>
                      <div className="mt-auto pt-3 flex justify-end">
                        <Link
                          href={`/mypage/reviews/write/${item.id}`}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
                        >
                          리뷰 작성
                        </Link>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="written" className="mt-4">
          {myReviews.length === 0 ? (
            <Empty
              icon={Inbox}
              message="작성한 리뷰가 없습니다"
              sub="구매한 상품에 대한 리뷰를 남겨보세요"
            />
          ) : (
            <ul className="space-y-3">
              {myReviews.map((review) => (
                <MyReviewCard key={review.id} review={review} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ReviewsTabs
