import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import ReviewsTabs, {
  type WritableItem,
  type MyReview,
} from "./ReviewsTabs"

export const metadata: Metadata = {
  title: "리뷰 관리 | 쥴리씨",
}

const ReviewsPage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirect=/mypage/reviews")

  const [{ data: writableData }, { data: reviewsData }] = await Promise.all([
    supabase
      .from("order_items")
      .select(
        `
        id,
        product_id,
        product_name,
        product_image,
        color,
        size,
        quantity,
        is_reviewed,
        orders!inner(id, order_no, status, user_id, created_at),
        products(id, product_images(url, is_thumbnail, sort_order))
      `
      )
      .eq("orders.user_id", user.id)
      .eq("orders.status", "CONFIRMED")
      .eq("is_reviewed", false)
      .order("created_at", { referencedTable: "orders", ascending: false }),
    supabase
      .from("reviews")
      .select(
        `
        *,
        products(id, slug, name, product_images(url, is_thumbnail, sort_order)),
        order_items(color, size),
        review_images(url, sort_order)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ])

  return (
    <ReviewsTabs
      writableItems={(writableData ?? []) as unknown as WritableItem[]}
      myReviews={(reviewsData ?? []) as unknown as MyReview[]}
    />
  )
}

export default ReviewsPage
