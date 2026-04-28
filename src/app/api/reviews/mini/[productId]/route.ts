import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { ReviewWithImages } from "@/types"

interface RouteContext {
  params: { productId: string }
}

const DEFAULT_LIMIT = 8
const MAX_LIMIT = 20

export const GET = async (request: Request, { params }: RouteContext) => {
  const productId = params.productId
  if (!productId) {
    return NextResponse.json(
      { error: "productId 파라미터가 필요합니다" },
      { status: 400 }
    )
  }

  const url = new URL(request.url)
  const limitParam = Number(url.searchParams.get("limit"))
  const limit = Math.min(
    MAX_LIMIT,
    Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT
  )

  const supabase = await createClient()

  // 사진이 있는 리뷰 우선, 그 다음 최신순
  // PostgREST는 join된 자식 테이블 존재 여부 정렬을 직접 지원하지 않으므로
  // 충분히 가져온 뒤 클라이언트에서 정렬한다.
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      *,
      images:review_images(*),
      user:profiles(name, height, weight)
    `
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit * 3)

  if (error) {
    return NextResponse.json(
      { error: "미니 리뷰 조회 실패" },
      { status: 500 }
    )
  }

  const reviews = ((data as unknown) as ReviewWithImages[] | null) ?? []

  const sorted = [...reviews].sort((a, b) => {
    const ai = a.images?.length ?? 0
    const bi = b.images?.length ?? 0
    if ((bi > 0 ? 1 : 0) - (ai > 0 ? 1 : 0) !== 0) {
      return (bi > 0 ? 1 : 0) - (ai > 0 ? 1 : 0)
    }
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  })

  return NextResponse.json({
    reviews: sorted.slice(0, limit),
  })
}
