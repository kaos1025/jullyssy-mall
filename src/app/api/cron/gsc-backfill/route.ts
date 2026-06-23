import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getAccessToken,
  getSiteUrl,
  searchAnalyticsQuery,
} from "@/lib/seo/gsc/client"
import {
  toGscDate,
  toQueryMetricRows,
  toPageMetricRows,
} from "@/lib/seo/gsc/helpers"

// Node 런타임 고정(default). createAdminClient(service role) + GSC REST 호출 + Sentry(Node).
// 캐시 금지(매 실행 신규 조회). 백필은 일자별 무거운 작업 → maxDuration 300.
export const dynamic = "force-dynamic"
export const maxDuration = 300

// 1회 invocation 청크 — earliest-1부터 과거로 최대 60일 처리.
const CHUNK_DAYS = 60
// 1회 invocation 호출수 hard cap(쿼터·시간 보호). 도달 시 즉시 중단(다음 invocation이 이어받음).
const API_CALL_CAP = 120
const MS_PER_DAY = 86_400_000
// 백필 하한 — 16개월 전. GSC 보존 한계.
const FLOOR_MONTHS = 16

// pg_cron + pg_net이 vault 'gsc_sync_auth' Bearer로 호출. 인바운드 인증.
const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

// 16개월 전 floor 날짜(YYYY-MM-DD).
const floorDate = (today: Date): string => {
  const d = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  d.setUTCMonth(d.getUTCMonth() - FLOOR_MONTHS)
  return toGscDate(d)
}

const handler = async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // ?dryRun=1 — 처리 예정 범위만 계산해 반환(GSC 읽기·DB 쓰기 0).
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"

  const admin = createAdminClient()
  let phase = "plan"

  try {
    const today = new Date()
    const floor = floorDate(today)

    // ── 재개 지점 결정 ────────────────────────────────────────────────────────
    // gsc_query_metrics의 최소 date - 1일부터 과거로. 비었으면 어제부터.
    phase = "resume_point"
    const todayMs = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    )

    // 재개 커서 = 이미 커버된 가장 오래된 날의 하루 전. "커버"는 두 출처의 최솟값:
    //   (1) gsc_query_metrics 최소 date — 행이 적재된 날
    //   (2) gsc_sync_log backfill 성공 date_target — 행 0건이어도 남는 진행 ledger
    // 행 0건 날짜는 metrics에 안 남으므로 (1)만 쓰면 과거 빈-날 구간에서 커서가
    // 전진하지 못해 같은 청크를 무한 반복한다. (2) ledger를 함께 봐 빈 날도 전진시킨다.
    const [minDataRes, minLogRes] = await Promise.all([
      admin
        .from("gsc_query_metrics")
        .select("date")
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("gsc_sync_log")
        .select("date_target")
        .eq("job_type", "backfill")
        .eq("status", "success")
        .not("date_target", "is", null)
        .order("date_target", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])
    if (minDataRes.error) throw minDataRes.error
    if (minLogRes.error) throw minLogRes.error

    const coveredMs: number[] = []
    if (minDataRes.data?.date)
      coveredMs.push(Date.parse(`${minDataRes.data.date}T00:00:00Z`))
    if (minLogRes.data?.date_target)
      coveredMs.push(Date.parse(`${minLogRes.data.date_target}T00:00:00Z`))

    // 커버 기록 있으면 그 최솟값-1일, 없으면(완전 빈 상태) 어제부터.
    const cursorMs =
      coveredMs.length > 0
        ? Math.min(...coveredMs) - MS_PER_DAY
        : todayMs - MS_PER_DAY

    const floorMs = Date.parse(`${floor}T00:00:00Z`)
    const chunkEndMs = cursorMs
    const chunkFloorMs = Math.max(floorMs, cursorMs - (CHUNK_DAYS - 1) * MS_PER_DAY)

    // 이미 floor 아래면 아무것도 안 함.
    if (cursorMs < floorMs) {
      return NextResponse.json({
        ok: true,
        dryRun,
        processedFrom: null,
        processedTo: null,
        apiCalls: 0,
        reachedFloor: true,
      })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        plannedFrom: toGscDate(new Date(chunkEndMs)),
        plannedTo: toGscDate(new Date(chunkFloorMs)),
        floor,
        chunkDays: CHUNK_DAYS,
        apiCallCap: API_CALL_CAP,
      })
    }

    // ── 일자별 처리(과거 방향) ────────────────────────────────────────────────
    phase = "auth"
    const accessToken = await getAccessToken()
    const siteUrl = getSiteUrl()

    let apiCalls = 0
    let processedFrom: string | null = null
    let processedTo: string | null = null
    let reachedFloor = false

    for (let dayMs = chunkEndMs; dayMs >= chunkFloorMs; dayMs -= MS_PER_DAY) {
      // hard cap: 호출수 도달 시 중단(다음 invocation이 이어받음).
      // 하루 = query + page 2콜 → cap 직전 여유(+2) 확보.
      if (apiCalls + 2 > API_CALL_CAP) break

      const day = toGscDate(new Date(dayMs))
      const fetchedAt = new Date().toISOString()
      let dayUpserted = 0

      // a. date+query (단일 일자)
      phase = "query_metrics"
      const queryRows = await searchAnalyticsQuery({
        siteUrl,
        accessToken,
        startDate: day,
        endDate: day,
        dimensions: ["date", "query"],
        dataState: "all",
      })
      apiCalls += 1
      const queryUpserts = toQueryMetricRows(queryRows, fetchedAt)
      if (queryUpserts.length > 0) {
        const { error } = await admin
          .from("gsc_query_metrics")
          .upsert(queryUpserts, { onConflict: "date,query" })
        if (error) throw error
      }
      dayUpserted += queryUpserts.length

      // b. date+page (단일 일자)
      phase = "page_metrics"
      const pageRows = await searchAnalyticsQuery({
        siteUrl,
        accessToken,
        startDate: day,
        endDate: day,
        dimensions: ["date", "page"],
        dataState: "all",
      })
      apiCalls += 1
      const pageUpserts = toPageMetricRows(pageRows, fetchedAt)
      if (pageUpserts.length > 0) {
        const { error } = await admin
          .from("gsc_page_metrics")
          .upsert(pageUpserts, { onConflict: "date,page_path" })
        if (error) throw error
      }
      dayUpserted += pageUpserts.length

      // sync_log 일자별 기록.
      phase = "log"
      await admin.from("gsc_sync_log").insert({
        job_type: "backfill",
        date_target: day,
        status: "success",
        rows_upserted: dayUpserted,
        api_calls_used: 2,
        finished_at: new Date().toISOString(),
      })

      if (processedFrom === null) processedFrom = day
      processedTo = day

      // floor 도달 여부.
      if (dayMs <= floorMs) reachedFloor = true
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      processedFrom,
      processedTo,
      apiCalls,
      reachedFloor,
    })
  } catch (err) {
    // pg_net 재시도 폭주 방지 → 500 대신 HTTP 200 + {ok:false}. 관측은 Sentry.
    Sentry.captureException(err, { tags: { type: "gsc.backfill", phase } })
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message })
  }
}

// pg_net 및 수동 점검 모두 POST. 이 경로는 CSRF 면제이므로 상태 변경 액션을 GET으로 노출하지 않는다
// (안전 메서드만 허용 — 면제 경로의 부작용 GET 방지). 인증은 Bearer CRON_SECRET.
export const POST = handler
