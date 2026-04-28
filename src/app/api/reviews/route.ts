import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  REVIEW_TAG_OPTIONS,
  type ReviewTagAxis,
  type ReviewTagOption,
} from "@/types/review"

const PHOTO_REVIEW_POINT = 500
const TEXT_REVIEW_POINT = 100

const pickTag = (
  formData: FormData,
  field: string,
  axis: ReviewTagAxis
): ReviewTagOption | null => {
  const raw = formData.get(field)
  if (typeof raw !== "string" || !raw) return null
  return (REVIEW_TAG_OPTIONS[axis] as readonly string[]).includes(raw)
    ? (raw as ReviewTagOption)
    : null
}

export const POST = async (request: Request) => {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const formData = await request.formData()
  const productId = formData.get("product_id") as string
  const orderItemId = formData.get("order_item_id") as string
  const rating = Number(formData.get("rating"))
  const content = formData.get("content") as string
  const height = formData.get("height") ? Number(formData.get("height")) : null
  const weight = formData.get("weight") ? Number(formData.get("weight")) : null
  const purchasedSize = formData.get("purchased_size") as string | null
  const tagSize = pickTag(formData, "tag_size", "size")
  const tagColor = pickTag(formData, "tag_color", "color")
  const tagThickness = pickTag(formData, "tag_thickness", "thickness")
  const tagStretch = pickTag(formData, "tag_stretch", "stretch")

  if (!productId || !rating) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 })
  }

  // 구매확정된 주문상품인지 확인
  if (orderItemId) {
    const { data: orderItem } = await admin
      .from("order_items")
      .select("order_id, orders!inner(user_id, status)")
      .eq("id", orderItemId)
      .single()

    if (
      !orderItem ||
      (orderItem as unknown as { orders: { user_id: string; status: string } }).orders.user_id !== user.id ||
      (orderItem as unknown as { orders: { user_id: string; status: string } }).orders.status !== "CONFIRMED"
    ) {
      return NextResponse.json(
        { error: "구매확정된 주문상품만 리뷰 작성 가능합니다" },
        { status: 400 }
      )
    }
  }

  // 리뷰 생성
  const { data: review, error } = await admin
    .from("reviews")
    .insert({
      user_id: user.id,
      product_id: productId,
      order_item_id: orderItemId || null,
      rating,
      content: content || null,
      height,
      weight,
      purchased_size: purchasedSize || null,
      tag_size: tagSize,
      tag_color: tagColor,
      tag_thickness: tagThickness,
      tag_stretch: tagStretch,
    })
    .select()
    .single()

  if (error || !review) {
    return NextResponse.json({ error: "리뷰 작성 실패" }, { status: 500 })
  }

  // 주문상품 리뷰 완료 표시
  if (orderItemId) {
    await admin
      .from("order_items")
      .update({ is_reviewed: true })
      .eq("id", orderItemId)
  }

  // 이미지 업로드 (최대 3장) — 실패는 console.error 로 추적, 부분 실패 응답에 포함
  const images = formData.getAll("images") as File[]
  const uploadErrors: string[] = []
  let uploadedCount = 0

  for (let i = 0; i < Math.min(images.length, 3); i++) {
    const file = images[i]
    if (!file || file.size === 0) continue

    const ext = file.name.split(".").pop()
    const path = `reviews/${review.id}/${Date.now()}_${i}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from("review-images")
      .upload(path, buffer, { contentType: file.type })

    if (uploadError) {
      console.error("[review-image-upload] failed:", {
        reviewId: review.id,
        fileName: file.name,
        error: uploadError.message,
      })
      uploadErrors.push(`${file.name}: ${uploadError.message}`)
      continue
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("review-images").getPublicUrl(path)

    const { error: insertError } = await admin
      .from("review_images")
      .insert({
        review_id: review.id,
        url: publicUrl,
        sort_order: i,
      })

    if (insertError) {
      console.error("[review-image-row] failed:", {
        reviewId: review.id,
        error: insertError.message,
      })
      uploadErrors.push(`${file.name}: DB insert failed`)
      continue
    }

    uploadedCount += 1
  }

  // 포인트 적립 — 실제 업로드 성공 카운트 기반 (첨부 의도가 아니라)
  const hasPhotos = uploadedCount > 0
  const pointReward = hasPhotos ? PHOTO_REVIEW_POINT : TEXT_REVIEW_POINT
  const { data: profile } = await admin
    .from("profiles")
    .select("point")
    .eq("id", user.id)
    .single()

  if (profile) {
    await admin
      .from("profiles")
      .update({ point: profile.point + pointReward })
      .eq("id", user.id)

    await admin.from("point_histories").insert({
      user_id: user.id,
      amount: pointReward,
      reason: hasPhotos ? "포토리뷰 적립" : "리뷰 적립",
    })
  }

  return NextResponse.json({
    success: true,
    review_id: review.id,
    point_reward: pointReward,
    uploaded_count: uploadedCount,
    upload_errors: uploadErrors.length > 0 ? uploadErrors : undefined,
  })
}
