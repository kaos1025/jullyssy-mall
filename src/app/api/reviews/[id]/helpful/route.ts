import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { reviewsLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

const postHandler = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const admin = createAdminClient()

  const { data: review } = await admin
    .from("reviews")
    .select("helpful_count")
    .eq("id", params.id)
    .single()

  if (!review) {
    return NextResponse.json({ error: "리뷰를 찾을 수 없습니다" }, { status: 404 })
  }

  await admin
    .from("reviews")
    .update({ helpful_count: review.helpful_count + 1 })
    .eq("id", params.id)

  // 도움돼요 카운트 변경 → PDP 캐시(product-detail, tags ["products"]) 무효화
  revalidateTag("products")

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(reviewsLimiter, postHandler)
