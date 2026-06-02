import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  extractFitFromTags,
  extractFitFromDescription,
} from "@/lib/seo/description-parser"
import { isApparelTopSlug } from "@/lib/product/category"

// v0.8 Track 1-C D5 — fit_type 자동 재매핑 (의류 카테고리 한정).
//
// ACTIVE + fit_type='REGULAR' 중 의류 카테고리(상의/하의/아우터/원피스세트)만 대상으로
// sellerTags(Layer 1.5) → description(Layer 2) 휴리스틱 추출. import resolveFitType의
// Layer 순서를 동일하게 따른다 (productAttributes Layer 1은 네이버 API 필요 → 제외).
//
// 가방/신발/악세서리/무카테고리는 제외: fit_type 무의미 + description "오버사이즈" 등
// 키워드 오탐 방지 (Phase 0 dry-run에서 호보백→OVERSIZED 등 확인). → 그리드 수동 보정.
//
// body: { apply?: boolean (default false=preview), enqueue?: boolean (default true) }
//   - apply=false: 변경 예정 목록만 반환 (write 없음)
//   - apply=true : products.fit_type UPDATE + (enqueue) seo_generation_queue replace

interface CatRow {
  id: string
  slug: string | null
  parent_id: string | null
}

const postHandler = async (request: Request) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const apply = body?.apply === true
  const enqueue = body?.enqueue !== false // 기본 true

  const admin = createAdminClient()

  // 카테고리 → 의류 판별 맵 (상품 category가 TOP 직속 또는 하위 모두 처리)
  const { data: cats, error: catErr } = await admin
    .from("categories")
    .select("id, slug, parent_id")
  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 })
  }
  const catMap = new Map<string, CatRow>()
  for (const c of cats ?? []) catMap.set(c.id, c as CatRow)

  const isApparel = (catId: string | null): boolean => {
    if (!catId) return false
    const c = catMap.get(catId)
    if (!c) return false
    const topSlug = c.parent_id ? catMap.get(c.parent_id)?.slug : c.slug
    return isApparelTopSlug(topSlug)
  }

  // ACTIVE + REGULAR 만 후보 (이미 non-REGULAR인 건 운영자/속성매핑 권위 → 휴리스틱으로 덮지 않음)
  const { data: products, error: prodErr } = await admin
    .from("products")
    .select("id, name, description, search_tags, category_id, fit_type")
    .eq("status", "ACTIVE")
    .eq("fit_type", "REGULAR")
  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 })
  }
  const rows = products ?? []

  const changes: { id: string; name: string; to: string; via: string }[] = []
  let skippedNonApparel = 0
  let skippedNoCategory = 0
  let skippedNoExtract = 0

  for (const p of rows) {
    if (!p.category_id) {
      skippedNoCategory++
      continue
    }
    if (!isApparel(p.category_id)) {
      skippedNonApparel++
      continue
    }
    const tags = Array.isArray(p.search_tags) ? (p.search_tags as string[]) : []
    const exTags = extractFitFromTags(tags)
    const exDesc = extractFitFromDescription(p.description)
    const fit = exTags ?? exDesc // import Layer 순서 1.5 → 2
    if (!fit || fit === "REGULAR") {
      skippedNoExtract++
      continue
    }
    changes.push({
      id: p.id,
      name: p.name ?? "",
      to: fit,
      via: exTags ? "tags" : "desc",
    })
  }

  const summary = {
    apply,
    enqueue,
    active_regular: rows.length,
    candidates: changes.length,
    changes,
    skipped: {
      non_apparel: skippedNonApparel,
      no_category: skippedNoCategory,
      no_extract: skippedNoExtract,
    },
  }

  if (!apply) {
    return NextResponse.json({ ...summary, applied: 0, enqueued: 0, preview: true })
  }

  let applied = 0
  let enqueued = 0
  for (const ch of changes) {
    const { error: upErr } = await admin
      .from("products")
      .update({ fit_type: ch.to })
      .eq("id", ch.id)
    if (upErr) {
      Sentry.captureException(upErr, {
        tags: { seo_event: "refit_batch_update_failed", product_id: ch.id },
      })
      continue
    }
    applied++

    if (enqueue) {
      // pending 중복 회피 후 replace 모드로 적재 (핏 변경 → 상세설명 재생성)
      const { data: pending } = await admin
        .from("seo_generation_queue")
        .select("id")
        .eq("product_id", ch.id)
        .eq("status", "pending")
        .maybeSingle()
      if (!pending) {
        const { error: qErr } = await admin
          .from("seo_generation_queue")
          .insert({
            product_id: ch.id,
            status: "pending",
            trigger_source: "refit_batch",
            description_mode: "replace",
          })
        if (qErr) {
          Sentry.captureException(qErr, {
            tags: { seo_event: "refit_batch_enqueue_failed", product_id: ch.id },
          })
        } else {
          enqueued++
        }
      }
    }
  }

  revalidatePath("/admin/products")
  revalidatePath("/products", "layout")

  return NextResponse.json({ ...summary, applied, enqueued, preview: false })
}

export const POST = withRateLimit(adminLimiter, postHandler)
