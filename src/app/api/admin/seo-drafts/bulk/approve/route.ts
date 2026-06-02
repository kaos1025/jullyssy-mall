import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { ensureImgAlts } from "@/lib/seo/description-parser"
import { buildPatternAlt } from "@/lib/seo/main-image-alt"

// v0.8 Track 2-A B-1 — SEO draft 일괄 승인.
// 단건 approve route(/[id]/approve)의 draft별 처리(이미지 alt 계산 + approve_seo_draft RPC)를
// 서버 루프로 재현. 클라 53회 순회는 adminLimiter(60/min) 초과 → 단일 요청 서버 처리.
// product_id 충돌 가드: 선택 안에 같은 제품 draft가 2개 이상이면 모두 skip(쌍은 단건 뷰에서).
// draft별 soft-fail — 1건 실패가 배치 전체를 막지 않음.

const MAX_BULK = 100

interface ImageRow {
  id: string
  sort_order: number | null
  created_at: string
}

const postHandler = async (request: Request) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string")
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: "선택된 draft가 없습니다" }, { status: 400 })
  }
  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_BULK}건까지 가능합니다` },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  const { data: draftRows, error: draftErr } = await supabase
    .from("seo_metadata_drafts")
    .select("id, product_id, status")
    .in("id", ids)
  if (draftErr) {
    return NextResponse.json({ error: draftErr.message }, { status: 500 })
  }

  const rowById = new Map<string, { product_id: string; status: string }>()
  const productCount = new Map<string, number>()
  for (const r of draftRows ?? []) {
    rowById.set(r.id, { product_id: r.product_id, status: r.status })
    productCount.set(r.product_id, (productCount.get(r.product_id) ?? 0) + 1)
  }

  const approved: string[] = []
  const skipped: { id: string; reason: string }[] = []
  const failed: { id: string; error: string }[] = []
  const slugs = new Set<string>()

  for (const id of ids) {
    const row = rowById.get(id)
    if (!row) {
      skipped.push({ id, reason: "draft 없음" })
      continue
    }
    if (row.status !== "pending_review") {
      skipped.push({ id, reason: `pending_review 아님 (${row.status})` })
      continue
    }
    if ((productCount.get(row.product_id) ?? 0) > 1) {
      skipped.push({ id, reason: "동일 제품 복수 선택 — 단건 뷰에서 처리" })
      continue
    }

    try {
      const { data: product, error: pErr } = await supabase
        .from("products")
        .select("id, name, slug, description")
        .eq("id", row.product_id)
        .maybeSingle()
      if (pErr) throw new Error(pErr.message)
      if (!product) throw new Error("product 없음")

      const { data: imagesData, error: imgErr } = await supabase
        .from("product_images")
        .select("id, sort_order, created_at")
        .eq("product_id", product.id)
        .order("sort_order", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true })
      if (imgErr) throw new Error(imgErr.message)
      const images = (imagesData ?? []) as ImageRow[]

      // 4번째+ 이미지 패턴 alt (단건 approve와 동일)
      const patternAlts: { image_id: string; alt_text: string }[] = []
      for (let i = 3; i < images.length; i++) {
        patternAlts.push({
          image_id: images[i].id,
          alt_text: buildPatternAlt(product.name, i - 2),
        })
      }
      const processedDescription = ensureImgAlts(product.description, [], {})

      const { error: rpcErr } = await supabase.rpc("approve_seo_draft", {
        p_draft_id: id,
        p_processed_description: processedDescription,
        p_pattern_alts: patternAlts,
        p_reviewer_id: adminUser.id,
        p_review_note: null,
      })
      if (rpcErr) throw new Error(rpcErr.message)

      approved.push(id)
      if (product.slug) slugs.add(product.slug)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "승인 실패"
      Sentry.captureException(e instanceof Error ? e : new Error(msg), {
        tags: { seo_event: "bulk_approve_failed", draft_id: id },
      })
      failed.push({ id, error: msg })
    }
  }

  // CDN 캐시 무효화 (승인된 제품 1회씩)
  for (const slug of Array.from(slugs)) revalidatePath(`/products/${slug}`)
  if (slugs.size > 0) revalidatePath("/products", "layout")

  return NextResponse.json({
    approved: approved.length,
    approved_ids: approved,
    skipped,
    failed,
  })
}

export const POST = withRateLimit(adminLimiter, postHandler)
