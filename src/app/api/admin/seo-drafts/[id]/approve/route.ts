import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { ensureImgAlts } from "@/lib/seo/description-parser"
import { buildPatternAlt } from "@/lib/seo/main-image-alt"

interface RouteContext {
  params: { id: string }
}

interface ApproveBody {
  note?: string
}

interface DraftRow {
  id: string
  product_id: string
  status: string
}

interface ProductRow {
  id: string
  name: string
  slug: string
  description: string | null
}

interface ImageRow {
  id: string
  sort_order: number | null
  created_at: string
}

interface PatternAlt {
  image_id: string
  alt_text: string
}

const postHandler = async (request: NextRequest, context: RouteContext) => {
  // Sentry tag: request-scoped isolation (@sentry/nextjs 10.x).
  Sentry.setTag("seo_draft_action", "approve")
  Sentry.setTag("seo_draft_id", context.params.id)

  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body: ApproveBody = await request.json().catch(() => ({}))
  const note =
    typeof body?.note === "string" && body.note.trim().length > 0
      ? body.note.trim()
      : null

  const supabase = createAdminClient()

  // draft 조회 + status 검증 (RPC 내부에서도 재검증되지만 빠른 실패용)
  const { data: draftRow, error: draftErr } = await supabase
    .from("seo_metadata_drafts")
    .select("id, product_id, status")
    .eq("id", context.params.id)
    .maybeSingle()
  if (draftErr) {
    Sentry.captureException(draftErr, {
      tags: { seo_event: "approve_draft_fetch_failed" },
    })
    return NextResponse.json({ error: draftErr.message }, { status: 500 })
  }
  if (!draftRow) {
    return NextResponse.json({ error: "draft 없음" }, { status: 404 })
  }
  const draft = draftRow as DraftRow
  Sentry.setTag("product_id", draft.product_id)
  if (draft.status !== "pending_review") {
    return NextResponse.json(
      {
        error: `pending_review 상태 draft만 승인 가능합니다 (현재: ${draft.status})`,
      },
      { status: 409 },
    )
  }

  // product + description 조회 (ensureImgAlts 처리용)
  const { data: productRow, error: productErr } = await supabase
    .from("products")
    .select("id, name, slug, description")
    .eq("id", draft.product_id)
    .maybeSingle()
  if (productErr) {
    Sentry.captureException(productErr, {
      tags: { seo_event: "approve_product_fetch_failed" },
    })
    return NextResponse.json({ error: productErr.message }, { status: 500 })
  }
  if (!productRow) {
    return NextResponse.json({ error: "product 없음" }, { status: 404 })
  }
  const product = productRow as ProductRow

  // 전체 product_images 조회 (4번째+ 패턴 alt 미리 계산용)
  const { data: imagesData, error: imagesErr } = await supabase
    .from("product_images")
    .select("id, sort_order, created_at")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
  if (imagesErr) {
    Sentry.captureException(imagesErr, {
      tags: { seo_event: "approve_images_fetch_failed" },
    })
    return NextResponse.json({ error: imagesErr.message }, { status: 500 })
  }
  const images = (imagesData ?? []) as ImageRow[]

  // 4번째+ 이미지에 패턴 alt 계산 (image_id 직접 매칭)
  const patternAlts: PatternAlt[] = []
  for (let i = 3; i < images.length; i++) {
    patternAlts.push({
      image_id: images[i].id,
      alt_text: buildPatternAlt(product.name, i - 2),
    })
  }

  // description HTML <img alt=""> 일괄 처리 (Vercel Node node-html-parser)
  const processedDescription = ensureImgAlts(product.description, [], {})

  // RPC 호출 (트랜잭션)
  const { error: rpcErr } = await supabase.rpc("approve_seo_draft", {
    p_draft_id: draft.id,
    p_processed_description: processedDescription,
    p_pattern_alts: patternAlts,
    p_reviewer_id: admin.id,
    p_review_note: note,
  })
  if (rpcErr) {
    Sentry.captureException(rpcErr, {
      tags: { seo_event: "approve_rpc_failed" },
      extra: { pattern_alts_count: patternAlts.length },
    })
    return NextResponse.json(
      { error: rpcErr.message, code: "RPC_FAILED" },
      { status: 500 },
    )
  }

  // CDN 캐시 무효화
  if (product.slug) {
    revalidatePath(`/products/${product.slug}`)
  }
  revalidatePath("/products", "layout")

  return NextResponse.json({ ok: true })
}

export const POST = withRateLimit(adminLimiter, postHandler)
