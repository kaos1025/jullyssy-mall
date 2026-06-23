import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getAccessToken,
  getSiteUrl,
  searchAnalyticsQuery,
  urlInspect,
} from "@/lib/seo/gsc/client"
import {
  trailingWindow,
  toQueryMetricRows,
  toPageMetricRows,
} from "@/lib/seo/gsc/helpers"

// Node 런타임 고정(default). createAdminClient(service role) + GSC REST 호출(google-auth-library) +
// Sentry(Node)를 한 런타임에서. 캐시 금지(매 실행 신규 조회).
export const dynamic = "force-dynamic"
export const maxDuration = 120

// 무료 쿼터 보호 — URL Inspection은 ~2000/day·600/min. 1회 실행 회전 cap.
const TRAILING_DAYS = 5
const INSPECTION_CAP = 20
// 동시성 락: 진행중 'daily' 행이 이 시간 내면 중복 invocation으로 보고 skip.
const LOCK_WINDOW_MS = 10 * 60 * 1000
// 정적 후보 경로(상품 PDP 외 핵심 인덱서블 URL).
const STATIC_PATHS = ["/", "/products", "/guide"]

// pg_cron + pg_net이 vault 'gsc_sync_auth' Bearer로 호출. 인바운드 인증.
const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

// GSC 속성 URL → 검사용 절대 origin.
// Domain 속성('sc-domain:...')은 origin이 없으므로 prod 도메인으로 고정.
// URL-prefix 속성('https://...')은 그 값에서 origin 추출.
const resolveSiteOrigin = (siteUrl: string): string => {
  if (siteUrl.startsWith("sc-domain:")) return "https://jullyssy.shop"
  try {
    return new URL(siteUrl).origin
  } catch {
    return "https://jullyssy.shop"
  }
}

interface SyncLogRow {
  job_type: string
  date_target: string | null
  status: string
  rows_upserted: number
  api_calls_used: number
  error_message: string | null
}

type Admin = ReturnType<typeof createAdminClient>

const handler = async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // ?dryRun=1 — GSC 읽기는 수행하되 모든 DB 쓰기(락/UPSERT/sync_log) skip, 집계만 반환.
  // 활성화 전 전건 프리뷰(0 쓰기)로 실데이터 판정을 전수 대조하는 게이트 + 운영 중 상시 디버그.
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"

  const admin = createAdminClient()

  // phase는 에러 시 Sentry 태그로. 진행 단계별 갱신.
  let phase = "lock"
  // 실 모드에서 잡은 락 행 id. dryRun은 null 유지.
  let lockId: number | null = null

  try {
    // ── 동시성 락(soft) ──────────────────────────────────────────────────────
    // 진행중 'daily' 행이 LOCK_WINDOW 내면 중복 invocation → skipped_lock 기록 후 종료.
    // dryRun은 락 읽기/쓰기 모두 skip(쓰기 0 원칙).
    if (!dryRun) {
      const lockThreshold = new Date(Date.now() - LOCK_WINDOW_MS).toISOString()
      const { data: inProgress } = await admin
        .from("gsc_sync_log")
        .select("id")
        .eq("job_type", "daily")
        .eq("status", "in_progress")
        .gte("started_at", lockThreshold)
        .limit(1)

      if (inProgress && inProgress.length > 0) {
        await admin.from("gsc_sync_log").insert({
          job_type: "daily",
          status: "skipped_lock",
        })
        return NextResponse.json({ ok: true, skipped: "lock" })
      }

      const { data: lockRow, error: lockError } = await admin
        .from("gsc_sync_log")
        .insert({ job_type: "daily", status: "in_progress" })
        .select("id")
        .single()
      if (lockError) throw lockError
      lockId = lockRow?.id ?? null
    }

    // ── Search Analytics ─────────────────────────────────────────────────────
    phase = "auth"
    const accessToken = await getAccessToken()
    const siteUrl = getSiteUrl()
    const siteOrigin = resolveSiteOrigin(siteUrl)
    const { startDate, endDate } = trailingWindow(new Date(), TRAILING_DAYS)
    const fetchedAt = new Date().toISOString()

    const logs: SyncLogRow[] = []
    let totalUpserted = 0

    // a. date+query → gsc_query_metrics (onConflict 'date,query')
    phase = "query_metrics"
    const queryRows = await searchAnalyticsQuery({
      siteUrl,
      accessToken,
      startDate,
      endDate,
      dimensions: ["date", "query"],
      dataState: "all",
    })
    const queryUpserts = toQueryMetricRows(queryRows, fetchedAt)
    if (!dryRun && queryUpserts.length > 0) {
      const { error } = await admin
        .from("gsc_query_metrics")
        .upsert(queryUpserts, { onConflict: "date,query" })
      if (error) throw error
    }
    totalUpserted += queryUpserts.length
    logs.push({
      job_type: "query_metrics",
      date_target: endDate,
      status: "success",
      rows_upserted: queryUpserts.length,
      api_calls_used: 1,
      error_message: null,
    })

    // b. date+page → gsc_page_metrics (onConflict 'date,page_path'), page는 stripToPath
    phase = "page_metrics"
    const pageRows = await searchAnalyticsQuery({
      siteUrl,
      accessToken,
      startDate,
      endDate,
      dimensions: ["date", "page"],
      dataState: "all",
    })
    const pageUpserts = toPageMetricRows(pageRows, fetchedAt)
    if (!dryRun && pageUpserts.length > 0) {
      const { error } = await admin
        .from("gsc_page_metrics")
        .upsert(pageUpserts, { onConflict: "date,page_path" })
      if (error) throw error
    }
    totalUpserted += pageUpserts.length
    logs.push({
      job_type: "page_metrics",
      date_target: endDate,
      status: "success",
      rows_upserted: pageUpserts.length,
      api_calls_used: 1,
      error_message: null,
    })

    // ── URL Inspection 회전(~20/run) ─────────────────────────────────────────
    // 후보 = 정적 경로 + ACTIVE 상품 PDP. 미검사 우선, 그다음 inspected_at 오래된 순.
    phase = "url_inspection"
    const inspectionResult = await runUrlInspectionRotation(
      admin,
      siteOrigin,
      siteUrl,
      accessToken,
      dryRun,
    )
    totalUpserted += inspectionResult.upserted
    logs.push({
      job_type: "url_inspection",
      date_target: null,
      status: "success",
      rows_upserted: inspectionResult.upserted,
      api_calls_used: inspectionResult.apiCalls,
      error_message: null,
    })

    // ── sync_log 기록 + 락 마감 ──────────────────────────────────────────────
    phase = "finalize"
    if (!dryRun) {
      const insertLogs = logs.map((l) => ({
        ...l,
        finished_at: new Date().toISOString(),
      }))
      await admin.from("gsc_sync_log").insert(insertLogs)

      if (lockId !== null) {
        await admin
          .from("gsc_sync_log")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            rows_upserted: totalUpserted,
          })
          .eq("id", lockId)
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      window: { startDate, endDate },
      queryRows: queryUpserts.length,
      pageRows: pageUpserts.length,
      inspected: inspectionResult.upserted,
      inspectionApiCalls: inspectionResult.apiCalls,
      rowsUpserted: totalUpserted,
    })
  } catch (err) {
    // pg_net 재시도 폭주 방지 → 500 대신 HTTP 200 + {ok:false}. 관측은 Sentry + sync_log error.
    Sentry.captureException(err, { tags: { type: "gsc.sync", phase } })
    const message = err instanceof Error ? err.message : String(err)
    if (!dryRun && lockId !== null) {
      await admin
        .from("gsc_sync_log")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", lockId)
    }
    return NextResponse.json({ ok: false, error: message })
  }
}

// ACTIVE 상품 PDP + 정적 경로 중 미검사/최오래된 ~20개를 inspect → upsert.
// 한 건 실패가 전체를 중단시키지 않도록 건별 try/catch(격리).
const runUrlInspectionRotation = async (
  admin: Admin,
  siteOrigin: string,
  siteUrl: string,
  accessToken: string,
  dryRun: boolean,
): Promise<{ upserted: number; apiCalls: number }> => {
  // 후보 경로 수집: 정적 + ACTIVE 상품(slug || id).
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, slug")
    .eq("status", "ACTIVE")
  if (productsError) throw productsError

  const productPaths = (products ?? []).map(
    (p: { id: string; slug: string | null }) =>
      `/products/${p.slug ?? p.id}`,
  )
  const candidatePaths = Array.from(
    new Set([...STATIC_PATHS, ...productPaths]),
  )

  // 기존 검사 시각 조회 → 미검사 우선, 그다음 inspected_at 오래된 순.
  const { data: existing, error: existingError } = await admin
    .from("gsc_url_inspections")
    .select("url_path, inspected_at")
    .order("inspected_at", { ascending: true })
  if (existingError) throw existingError

  const inspectedAtByPath = new Map<string, string>()
  for (const row of existing ?? []) {
    inspectedAtByPath.set(row.url_path, row.inspected_at)
  }

  const ordered = [...candidatePaths].sort((a, b) => {
    const ta = inspectedAtByPath.get(a)
    const tb = inspectedAtByPath.get(b)
    // 미검사(undefined)는 가장 오래된 것으로 취급해 우선 처리.
    if (ta === undefined && tb === undefined) return 0
    if (ta === undefined) return -1
    if (tb === undefined) return 1
    return ta.localeCompare(tb)
  })

  const targets = ordered.slice(0, INSPECTION_CAP)

  let upserted = 0
  let apiCalls = 0
  for (const urlPath of targets) {
    try {
      const result = await urlInspect({
        siteUrl,
        accessToken,
        inspectionUrl: `${siteOrigin}${urlPath}`,
      })
      apiCalls += 1
      if (!dryRun) {
        const { error } = await admin.from("gsc_url_inspections").upsert(
          {
            url_path: urlPath,
            verdict: result.verdict,
            coverage_state: result.coverageState,
            indexing_state: result.indexingState,
            last_crawl_time: result.lastCrawlTime,
            crawled_as: result.crawledAs,
            inspected_at: new Date().toISOString(),
          },
          { onConflict: "url_path" },
        )
        if (error) throw error
      }
      upserted += 1
    } catch (err) {
      // 건별 격리: 한 URL 실패가 회전 전체를 멈추지 않게. dead-letter로 Sentry(선택).
      Sentry.captureException(err, {
        tags: { type: "gsc.sync", phase: "url_inspection_item" },
        extra: { urlPath },
      })
    }
  }

  return { upserted, apiCalls }
}

// pg_net 및 수동 점검 모두 POST. 이 경로는 CSRF 면제이므로 상태 변경 액션을 GET으로 노출하지 않는다
// (안전 메서드만 허용 — 면제 경로의 부작용 GET 방지). 인증은 Bearer CRON_SECRET.
export const POST = handler
