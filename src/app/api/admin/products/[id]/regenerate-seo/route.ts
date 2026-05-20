import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

interface RouteContext {
  params: { id: string }
}

const ALLOWED_STATUSES = ["ACTIVE", "SOLDOUT", "HIDDEN"] as const

const postHandler = async (_request: NextRequest, context: RouteContext) => {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const productId = context.params.id
  const supabase = createAdminClient()

  // product 조회 + status 검증
  const { data: product, error: productErr } = await supabase
    .from("products")
    .select("id, status")
    .eq("id", productId)
    .maybeSingle()
  if (productErr) {
    return NextResponse.json({ error: productErr.message }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: "product 없음" }, { status: 404 })
  }
  if (!ALLOWED_STATUSES.includes(product.status)) {
    return NextResponse.json(
      { error: `상품 status가 ${product.status}여서 SEO 재생성 불가합니다` },
      { status: 400 },
    )
  }

  // 기존 pending row 중복 회피
  const { data: existing, error: existingErr } = await supabase
    .from("seo_generation_queue")
    .select("id")
    .eq("product_id", productId)
    .eq("status", "pending")
    .maybeSingle()
  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 })
  }
  if (existing) {
    return NextResponse.json(
      { error: "이미 pending 큐에 있습니다", queue_id: existing.id },
      { status: 409 },
    )
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("seo_generation_queue")
    .insert({
      product_id: productId,
      status: "pending",
      trigger_source: "manual_regenerate",
    })
    .select("id")
    .maybeSingle()
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, queue_id: inserted?.id })
}

export const POST = withRateLimit(adminLimiter, postHandler)
