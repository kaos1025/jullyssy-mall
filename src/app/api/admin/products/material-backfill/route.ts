import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { applyMaterialBackfill } from "@/lib/product/material-backfill"

// v0.8 마무리 M-1 apply — preview는 페이지가 server prefetch, 여기선 선택분 적용만 (L25 게이트).
const postHandler = async (request: Request) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const productIds: string[] = Array.isArray(body?.product_ids)
    ? body.product_ids.filter((x: unknown) => typeof x === "string")
    : []
  if (productIds.length === 0) {
    return NextResponse.json({ error: "선택된 상품이 없습니다" }, { status: 400 })
  }

  const result = await applyMaterialBackfill(productIds)

  revalidatePath("/products/[id]", "page")
  revalidatePath("/products", "layout")

  return NextResponse.json(result)
}

export const POST = withRateLimit(adminLimiter, postHandler)
