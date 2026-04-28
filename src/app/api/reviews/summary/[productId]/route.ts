import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ReviewTagSummaryRow } from "@/types/review"

interface RouteContext {
  params: { productId: string }
}

export const GET = async (_request: Request, { params }: RouteContext) => {
  const productId = params.productId
  if (!productId) {
    return NextResponse.json(
      { error: "productId 파라미터가 필요합니다" },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // 리뷰 총 개수 (10개 미만이면 클라이언트에서 집계 뷰 숨김 판정)
  const { count, error: countError } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)

  if (countError) {
    return NextResponse.json(
      { error: "리뷰 개수 조회 실패" },
      { status: 500 }
    )
  }

  const { data, error } = await supabase.rpc(
    "get_product_review_tag_summary",
    { p_product_id: productId }
  )

  if (error) {
    return NextResponse.json(
      { error: "리뷰 태그 집계 실패" },
      { status: 500 }
    )
  }

  const rows = ((data as unknown) as ReviewTagSummaryRow[] | null) ?? []

  return NextResponse.json({
    review_count: count ?? 0,
    rows,
  })
}
