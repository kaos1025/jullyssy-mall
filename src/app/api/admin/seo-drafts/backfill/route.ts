// Backfill API — 기존 ACTIVE products에 대해 SEO 생성 큐 일괄 등록.
//
// spec v0.6 §5 Phase 3 FR-7. 사전 비용 검증 (SEO_AI_MONTHLY_USD_CAP 대비 412).
// scope:
//   - 'active'         — 모든 ACTIVE product (재생성 포함)
//   - 'active_no_seo'  — ACTIVE 중 meta_title NULL OR seo_updated_at NULL인 product
//
// dry_run=true 시 큐 insert 없이 카운트/예상 비용만 응답.
// 기존 pending/processing 큐 row가 있는 product는 자동 제외 (중복 회피).
//
// D3 PoC 보강: product_ids 옵션 (1~10 UUID). 제공 시 scope/limit 무시하고 명시 선정.
// PoC §2 "샘플 3건 명시 선정" 정합성 100% 보장 + 정식 backfill 정확 선정 경로 동시 충족.

import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

// spec v0.6 §4 비용 가정 (Phase 1 live 검증 $0.0095/상품).
const COST_PER_PRODUCT_USD = 0.0095
const ALLOWED_SCOPES = ["active", "active_no_seo"] as const
type BackfillScope = (typeof ALLOWED_SCOPES)[number]

const ALLOWED_DESCRIPTION_MODES = ["preserve", "replace"] as const
type DescriptionMode = (typeof ALLOWED_DESCRIPTION_MODES)[number]
// spec v0.7 §4.1 [2단계] — 신규 default for v0.7 = 'replace' (DB column default 'preserve' 의존 차단).
const DEFAULT_DESCRIPTION_MODE: DescriptionMode = "replace"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// 1회 호출 비용 임계 가드: 50건 × $0.01523 ≈ $0.76 (cap $20 대비 3.8%).
// 412 cap 사전 검증은 별도 layer로 유지.
const MAX_PRODUCT_IDS = 50

interface BackfillBody {
  scope?: BackfillScope
  limit?: number
  dry_run?: boolean
  /** D3 PoC — true 시 각 상품에 preserve + replace 2개 큐 insert. default false (회귀 0). */
  poc_mode?: boolean
  /** D3 PoC 보강 — 1~10 UUID. 제공 시 scope/limit 무시하고 명시 선정. */
  product_ids?: string[]
  /** spec v0.7 §4.1 — 일반 경로 큐 description_mode. default 'replace'. poc_mode=true 시 무시. */
  description_mode?: DescriptionMode
}

type Validation =
  | {
      ok: true
      scope: BackfillScope
      limit: number
      dryRun: boolean
      pocMode: boolean
      /** null이면 scope/limit 경로 (회귀 0). string[] 제공 시 product_ids 경로. */
      productIds: string[] | null
      descriptionMode: DescriptionMode
    }
  | { ok: false; error: string }

const validateBody = (body: unknown): Validation => {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "잘못된 요청 형식" }
  }
  const b = body as BackfillBody
  const scope = b.scope ?? "active_no_seo"
  if (!ALLOWED_SCOPES.includes(scope)) {
    return {
      ok: false,
      error: `scope는 ${ALLOWED_SCOPES.join(" 또는 ")}여야 합니다`,
    }
  }
  const limit = b.limit ?? 500
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 500
  ) {
    return { ok: false, error: "limit는 1~500 정수여야 합니다" }
  }
  const dryRun = b.dry_run ?? false
  if (typeof dryRun !== "boolean") {
    return { ok: false, error: "dry_run은 boolean이어야 합니다" }
  }
  const pocMode = b.poc_mode ?? false
  if (typeof pocMode !== "boolean") {
    return { ok: false, error: "poc_mode는 boolean이어야 합니다" }
  }

  const descriptionMode: DescriptionMode =
    b.description_mode ?? DEFAULT_DESCRIPTION_MODE
  if (!ALLOWED_DESCRIPTION_MODES.includes(descriptionMode)) {
    return {
      ok: false,
      error: `description_mode는 ${ALLOWED_DESCRIPTION_MODES.join(" 또는 ")}여야 합니다`,
    }
  }

  // product_ids 검증 — undefined/null이면 scope/limit 경로 (회귀 0)
  let productIds: string[] | null = null
  if (b.product_ids !== undefined && b.product_ids !== null) {
    if (!Array.isArray(b.product_ids)) {
      return { ok: false, error: "product_ids는 배열이어야 합니다" }
    }
    if (b.product_ids.length === 0) {
      return { ok: false, error: "product_ids 배열이 비어 있습니다" }
    }
    if (b.product_ids.length > MAX_PRODUCT_IDS) {
      return {
        ok: false,
        error: `product_ids는 최대 ${MAX_PRODUCT_IDS}건까지 허용됩니다`,
      }
    }
    for (const id of b.product_ids) {
      if (typeof id !== "string" || !UUID_RE.test(id)) {
        return { ok: false, error: `product_ids에 유효하지 않은 UUID: ${id}` }
      }
    }
    // 중복 제거 (운영자 입력 안전)
    productIds = Array.from(new Set(b.product_ids))
  }

  return { ok: true, scope, limit, dryRun, pocMode, productIds, descriptionMode }
}

const postHandler = async (request: NextRequest) => {
  Sentry.setTag("seo_event", "backfill_requested")

  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const v = validateBody(body)
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 })
  }

  const { scope, limit, dryRun, pocMode, productIds: requestedIds, descriptionMode } = v
  const targetMode = requestedIds !== null ? "product_ids" : "scope"
  Sentry.setTag("backfill_target_mode", targetMode)
  Sentry.setTag("backfill_scope", scope)
  Sentry.setTag("backfill_dry_run", String(dryRun))
  Sentry.setTag("backfill_poc_mode", String(pocMode))
  Sentry.setTag("backfill_description_mode", descriptionMode)

  // SEO_AI_MONTHLY_USD_CAP 등록 확증
  const capRaw = process.env.SEO_AI_MONTHLY_USD_CAP
  const cap = parseFloat(capRaw ?? "")
  if (!Number.isFinite(cap) || cap <= 0) {
    return NextResponse.json(
      {
        error: "SEO_AI_MONTHLY_USD_CAP 미설정",
        code: "CAP_NOT_SET",
      },
      { status: 412 },
    )
  }

  const supabase = createAdminClient()

  // 대상 products 조회 — product_ids 경로 또는 scope/limit 경로
  let productIds: string[]
  if (requestedIds !== null) {
    // D3 PoC 보강 — product_ids 명시 선정 경로
    const { data: foundProducts, error: lookupErr } = await supabase
      .from("products")
      .select("id, status")
      .in("id", requestedIds)
    if (lookupErr) {
      Sentry.captureException(lookupErr, {
        tags: { seo_event: "backfill_product_ids_lookup_failed" },
      })
      return NextResponse.json({ error: lookupErr.message }, { status: 500 })
    }
    const foundMap = new Map(
      (foundProducts ?? []).map((p) => [p.id as string, p.status as string]),
    )
    const failed: Array<{ product_id: string; reason: string }> = []
    for (const id of requestedIds) {
      const status = foundMap.get(id)
      if (status === undefined) {
        failed.push({ product_id: id, reason: "NOT_FOUND" })
      } else if (status !== "ACTIVE") {
        failed.push({ product_id: id, reason: `STATUS=${status}` })
      }
    }
    if (failed.length > 0) {
      return NextResponse.json(
        {
          error: "유효하지 않은 product_ids",
          code: "INVALID_PRODUCT_IDS",
          failed,
        },
        { status: 422 },
      )
    }
    productIds = requestedIds
  } else {
    // 기존 scope/limit 경로 (회귀 0)
    let listQuery = supabase
      .from("products")
      .select("id")
      .eq("status", "ACTIVE")
      .order("id", { ascending: true })
      .limit(limit)
    if (scope === "active_no_seo") {
      listQuery = listQuery.or("meta_title.is.null,seo_updated_at.is.null")
    }
    const { data: productsData, error: productsErr } = await listQuery
    if (productsErr) {
      Sentry.captureException(productsErr, {
        tags: { seo_event: "backfill_products_query_failed" },
      })
      return NextResponse.json({ error: productsErr.message }, { status: 500 })
    }
    productIds = (productsData ?? []).map((p) => p.id as string)
  }

  // 비용 사전 검증 — poc_mode 시 preserve + replace 2배 (각 상품 2개 큐 row).
  const queueMultiplier = pocMode ? 2 : 1
  const estimatedCostUsd = productIds.length * COST_PER_PRODUCT_USD * queueMultiplier

  const { data: monthCostData, error: monthCostErr } = await supabase.rpc(
    "seo_monthly_cost_usd",
  )
  if (monthCostErr) {
    Sentry.captureException(monthCostErr, {
      tags: { seo_event: "backfill_month_cost_rpc_failed" },
    })
    return NextResponse.json(
      { error: monthCostErr.message },
      { status: 500 },
    )
  }
  const monthCost = Number(monthCostData ?? 0)
  const remainingBudget = cap - monthCost

  if (estimatedCostUsd > remainingBudget) {
    Sentry.captureMessage("seo_monthly_cap_exceeded", {
      level: "error",
      tags: {
        seo_event: "cap_exceeded",
        backfill_scope: scope,
      },
      extra: {
        cap_usd: cap,
        month_cost_usd: monthCost,
        attempted_cost_usd: estimatedCostUsd,
        product_count: productIds.length,
      },
    })
    return NextResponse.json(
      {
        error: "월 예산 초과",
        code: "BUDGET_EXCEEDED",
        estimated_cost_usd: estimatedCostUsd,
        month_cost_usd: monthCost,
        remaining_budget_usd: remainingBudget,
        cap_usd: cap,
      },
      { status: 412 },
    )
  }

  // dry_run 분기
  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      target_mode: targetMode,
      poc_mode: pocMode,
      description_mode: pocMode ? null : descriptionMode,
      would_queue: productIds.length * queueMultiplier,
      estimated_cost_usd: estimatedCostUsd,
      month_cost_usd: monthCost,
      remaining_budget_usd: remainingBudget,
      cap_usd: cap,
    })
  }

  if (productIds.length === 0) {
    return NextResponse.json({
      queued: 0,
      skipped: 0,
      estimated_cost_usd: 0,
      message: "대상 product 0건",
    })
  }

  // 기존 pending/processing 큐 row 제외
  const { data: existingData, error: existingErr } = await supabase
    .from("seo_generation_queue")
    .select("product_id")
    .in("product_id", productIds)
    .in("status", ["pending", "processing"])
  if (existingErr) {
    Sentry.captureException(existingErr, {
      tags: { seo_event: "backfill_existing_check_failed" },
    })
    return NextResponse.json({ error: existingErr.message }, { status: 500 })
  }
  const excludeIds = new Set(
    (existingData ?? []).map((r) => r.product_id as string),
  )
  const insertIds = productIds.filter((id) => !excludeIds.has(id))

  if (insertIds.length === 0) {
    return NextResponse.json({
      queued: 0,
      skipped: excludeIds.size,
      estimated_cost_usd: 0,
      message: "모든 대상이 이미 큐에 있습니다",
    })
  }

  // bulk insert — poc_mode 시 각 product에 preserve + replace 2개 row.
  const queueRows = pocMode
    ? insertIds.flatMap((productId) => [
        {
          product_id: productId,
          status: "pending",
          trigger_source: "backfill_poc",
          description_mode: "preserve",
        },
        {
          product_id: productId,
          status: "pending",
          trigger_source: "backfill_poc",
          description_mode: "replace",
        },
      ])
    : insertIds.map((productId) => ({
        product_id: productId,
        status: "pending",
        trigger_source: "backfill",
        description_mode: descriptionMode,
      }))

  const { error: insertErr } = await supabase
    .from("seo_generation_queue")
    .insert(queueRows)
  if (insertErr) {
    Sentry.captureException(insertErr, {
      tags: { seo_event: "backfill_insert_failed" },
      extra: {
        insert_count: queueRows.length,
        product_count: insertIds.length,
        poc_mode: pocMode,
      },
    })
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    queued: queueRows.length,
    products: insertIds.length,
    target_mode: targetMode,
    poc_mode: pocMode,
    description_mode: pocMode ? null : descriptionMode,
    skipped: excludeIds.size,
    estimated_cost_usd: queueRows.length * COST_PER_PRODUCT_USD,
    month_cost_usd: monthCost,
    remaining_budget_usd: remainingBudget,
    cap_usd: cap,
  })
}

export const POST = withRateLimit(adminLimiter, postHandler)
