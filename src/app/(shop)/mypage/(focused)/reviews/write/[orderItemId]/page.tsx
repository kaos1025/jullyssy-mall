import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft } from "lucide-react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import ReviewFormBodyWrapper from "./ReviewFormBodyWrapper"

export const metadata: Metadata = {
  title: "리뷰 작성 | 쥴리씨",
}

interface Props {
  params: { orderItemId: string }
}

interface OrderItemShape {
  id: string
  product_id: string
  product_name: string
  color: string
  size: string
  is_reviewed: boolean
  orders: {
    id: string
    order_no: string
    status: string
    user_id: string
  }
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
}

const ReviewWritePage = async ({ params }: Props) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?redirect=/mypage/reviews/write/${params.orderItemId}`)
  }

  const { data: orderItem, error } = await supabase
    .from("order_items")
    .select(
      `
      id,
      product_id,
      product_name,
      color,
      size,
      is_reviewed,
      orders!inner(id, order_no, status, user_id),
      products(id, slug, name, product_images(url, is_thumbnail, sort_order))
    `
    )
    .eq("id", params.orderItemId)
    .eq("orders.user_id", user.id)
    .single()

  if (error || !orderItem) notFound()

  const oi = orderItem as unknown as OrderItemShape

  if (oi.orders.status !== "CONFIRMED") {
    redirect("/mypage/reviews?tab=writable")
  }
  if (oi.is_reviewed) {
    redirect("/mypage/reviews?tab=written")
  }

  const images = oi.products?.product_images ?? []
  const thumb =
    images.find((i) => i.is_thumbnail) ??
    [...images].sort((a, b) => a.sort_order - b.sort_order)[0]

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/mypage/reviews"
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
          리뷰 관리
        </Link>
        <h1 className="jl-h1 mt-2">리뷰 작성</h1>
      </div>

      <section className="flex gap-4 p-4 bg-subtle rounded-lg mb-6">
        <div className="relative w-20 h-[107px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          {thumb && (
            <Image
              src={thumb.url}
              alt={oi.product_name}
              fill
              sizes="80px"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-xs text-gray-500">주문 {oi.orders.order_no}</p>
          <p className="mt-1 text-sm font-medium line-clamp-2">
            {oi.product_name}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {oi.color} / {oi.size}
          </p>
        </div>
      </section>

      <ReviewFormBodyWrapper
        productId={oi.product_id}
        orderItemId={oi.id}
        productName={oi.product_name}
      />
    </div>
  )
}

export default ReviewWritePage
