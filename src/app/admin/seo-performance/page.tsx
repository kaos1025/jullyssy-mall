import { redirect } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { createAdminClient } from "@/lib/supabase/admin"
import type { GscQueryMetric, GscPageMetric, GscSyncLog, GscUrlInspection } from "@/types/gsc"
import Sparkline from "./_components/Sparkline"

// Full Route Cache 회피 — GSC 데이터는 매 요청마다 최신 반영
export const dynamic = "force-dynamic"

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** ISO 날짜 문자열을 상대 시간(~분 전, ~시간 전 등)으로 변환 */
const relativeTime = (isoStr: string | null): string => {
  if (!isoStr) return "–"
  const diff = Date.now() - new Date(isoStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "방금 전"
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

/** CTR을 % 문자열로 포맷 (소수점 1자리) */
const fmtCtr = (ctr: number): string => `${(ctr * 100).toFixed(1)}%`

/** Position을 소수점 1자리 문자열로 포맷 */
const fmtPos = (pos: number): string => pos.toFixed(1)

// ─── 집계 타입 ────────────────────────────────────────────────────────────────

interface QueryAgg {
  query: string
  clicks: number
  impressions: number
  ctr: number       // clicks/impressions
  position: number  // 단순 평균 (impressions 0건 대비 분모=rows)
  trend: number[]   // 일별 impressions 배열 (최근 28일, 오름차순)
}

interface PageAgg {
  page_path: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  trend: number[]
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

const AdminSeoPerformancePage = async () => {
  const admin = await verifyAdmin()
  if (!admin) redirect("/")

  const supabase = createAdminClient()

  // 28일 기준 날짜 (YYYY-MM-DD)
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10)

  // ── 병렬 데이터 패치 ──────────────────────────────────────────────────────

  const [syncLogRes, queryMetricsRes, pageMetricsRes, urlInspectRes] =
    await Promise.all([
      // 최근 동기화 이력 (최신 10건)
      supabase
        .from("gsc_sync_log")
        .select(
          "id,job_type,date_target,status,rows_upserted,api_calls_used,error_message,started_at,finished_at"
        )
        .order("started_at", { ascending: false })
        .limit(10),

      // 28일 쿼리 지표
      supabase
        .from("gsc_query_metrics")
        .select("date,query,clicks,impressions,ctr,position")
        .gte("date", since)
        .limit(10_000), // 쿼리×일 수 상한

      // 28일 페이지 지표
      supabase
        .from("gsc_page_metrics")
        .select("date,page_path,clicks,impressions,ctr,position")
        .gte("date", since)
        .limit(10_000),

      // URL 인덱싱 현황 (전체)
      supabase
        .from("gsc_url_inspections")
        .select("url_path,verdict,coverage_state,indexing_state,inspected_at")
        .limit(5_000),
    ])

  const syncLogs: GscSyncLog[] = (syncLogRes.data ?? []) as GscSyncLog[]
  const queryRows: Pick<GscQueryMetric, "date" | "query" | "clicks" | "impressions" | "ctr" | "position">[] =
    (queryMetricsRes.data ?? []) as Pick<GscQueryMetric, "date" | "query" | "clicks" | "impressions" | "ctr" | "position">[]
  const pageRows: Pick<GscPageMetric, "date" | "page_path" | "clicks" | "impressions" | "ctr" | "position">[] =
    (pageMetricsRes.data ?? []) as Pick<GscPageMetric, "date" | "page_path" | "clicks" | "impressions" | "ctr" | "position">[]
  const inspections: Pick<GscUrlInspection, "url_path" | "verdict" | "coverage_state" | "indexing_state" | "inspected_at">[] =
    (urlInspectRes.data ?? []) as Pick<GscUrlInspection, "url_path" | "verdict" | "coverage_state" | "indexing_state" | "inspected_at">[]

  // ── 동기화 상태 ─────────────────────────────────────────────────────────────

  // 가장 최근 성공 로그
  const lastSuccess = syncLogs.find((l) => l.status === "success") ?? null
  // 가장 최근 로그 (에러 여부 확인)
  const latestLog = syncLogs[0] ?? null
  const hasRecentError = latestLog?.status === "error"

  // ── 데이터 범위 ─────────────────────────────────────────────────────────────
  // query_metrics에서 min/max date 추출
  const allDates = queryRows.map((r) => r.date).sort()
  const dateMin = allDates[0] ?? null
  const dateMax = allDates[allDates.length - 1] ?? null

  // ── 인덱싱 카운트 ───────────────────────────────────────────────────────────
  /**
   * 인덱싱 판정 기준:
   * verdict='PASS' 이거나 coverage_state ILIKE '%indexed%' (Indexed, Submitted and indexed 등)을 indexed로 간주.
   * Google Search Console은 coverage_state로 상세 상태를 제공하므로
   * coverage_state에 'indexed' 문자열이 포함된 경우를 가장 넓게 포착.
   */
  const indexedCount = inspections.filter(
    (u) =>
      u.verdict === "PASS" ||
      (u.coverage_state?.toLowerCase().includes("indexed") ?? false)
  ).length
  const notIndexedCount = inspections.length - indexedCount

  // ── 쿼리 집계 ──────────────────────────────────────────────────────────────
  // 28일 내 데이터를 query별로 집계
  // trend: 날짜순 정렬 후 일별 impressions 배열 (spark용)
  const queryMap = new Map<
    string,
    {
      clicks: number
      impressions: number
      posSum: number
      rows: number
      dateImpMap: Map<string, number>
    }
  >()

  for (const row of queryRows) {
    const existing = queryMap.get(row.query)
    if (!existing) {
      queryMap.set(row.query, {
        clicks: row.clicks,
        impressions: row.impressions,
        posSum: row.position,
        rows: 1,
        dateImpMap: new Map([[row.date, row.impressions]]),
      })
    } else {
      existing.clicks += row.clicks
      existing.impressions += row.impressions
      existing.posSum += row.position
      existing.rows += 1
      // 같은 날 중복 방지 (date+query = PK이므로 실제로 없지만 안전하게)
      existing.dateImpMap.set(
        row.date,
        (existing.dateImpMap.get(row.date) ?? 0) + row.impressions
      )
    }
  }

  const topQueries: QueryAgg[] = Array.from(queryMap.entries())
    .map(([query, agg]) => {
      const trend = Array.from(agg.dateImpMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, imp]) => imp)
      return {
        query,
        clicks: agg.clicks,
        impressions: agg.impressions,
        // CTR = 총 clicks / 총 impressions
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        // position: 단순 평균 (행별 average의 평균 — impression-weighted 계산은 일별 raw 없이 불가)
        // 주석: GSC API가 반환하는 position은 이미 일별 impression-weighted avg이므로
        // 여기서는 단순 행 평균(같은 날 중복 없으므로 = 날짜 수 평균)을 사용.
        position: agg.rows > 0 ? agg.posSum / agg.rows : 0,
        trend,
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)

  // ── 페이지 집계 ─────────────────────────────────────────────────────────────
  const pageMap = new Map<
    string,
    {
      clicks: number
      impressions: number
      posSum: number
      rows: number
      dateImpMap: Map<string, number>
    }
  >()

  for (const row of pageRows) {
    const existing = pageMap.get(row.page_path)
    if (!existing) {
      pageMap.set(row.page_path, {
        clicks: row.clicks,
        impressions: row.impressions,
        posSum: row.position,
        rows: 1,
        dateImpMap: new Map([[row.date, row.impressions]]),
      })
    } else {
      existing.clicks += row.clicks
      existing.impressions += row.impressions
      existing.posSum += row.position
      existing.rows += 1
      existing.dateImpMap.set(
        row.date,
        (existing.dateImpMap.get(row.date) ?? 0) + row.impressions
      )
    }
  }

  const topPages: PageAgg[] = Array.from(pageMap.entries())
    .map(([page_path, agg]) => {
      const trend = Array.from(agg.dateImpMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, imp]) => imp)
      return {
        page_path,
        clicks: agg.clicks,
        impressions: agg.impressions,
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        position: agg.rows > 0 ? agg.posSum / agg.rows : 0,
        trend,
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)

  const hasData = queryRows.length > 0 || pageRows.length > 0

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">검색 성과 (GSC)</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Google Search Console 스냅샷 기준 — 최근 28일 집계
        </p>
      </div>

      {/* ── 동기화 상태 카드 ──────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          동기화 상태
        </h3>

        {hasRecentError && latestLog && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span className="font-semibold">최근 동기화 오류:</span>{" "}
            {latestLog.error_message ?? "알 수 없는 오류"}
            <span className="ml-2 text-xs text-muted-foreground">
              ({relativeTime(latestLog.started_at)})
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">마지막 성공</p>
            <p className="text-sm font-medium">
              {lastSuccess
                ? relativeTime(lastSuccess.started_at)
                : "없음"}
            </p>
            {lastSuccess?.finished_at && (
              <p className="text-xs text-muted-foreground">
                완료: {relativeTime(lastSuccess.finished_at)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">데이터 범위</p>
            <p className="text-sm font-medium">
              {dateMin && dateMax
                ? `${dateMin} ~ ${dateMax}`
                : "–"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">색인 완료</p>
            <p className="text-sm font-medium text-green-600">
              {inspections.length > 0 ? `${indexedCount}건` : "–"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">미색인</p>
            <p className="text-sm font-medium text-amber-600">
              {inspections.length > 0 ? `${notIndexedCount}건` : "–"}
            </p>
          </div>
        </div>
      </div>

      {/* ── 빈 상태 ──────────────────────────────────────────────────── */}
      {!hasData && (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          <p className="text-base font-medium">아직 수집된 데이터가 없습니다</p>
          <p className="text-sm mt-1">
            GSC 동기화 크론이 실행되면 이 화면에 데이터가 표시됩니다.
          </p>
        </div>
      )}

      {/* ── 인기 검색어 테이블 ────────────────────────────────────────── */}
      {topQueries.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold">
              인기 검색어 (최근 28일 · 노출순 상위 {topQueries.length}개)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    검색어
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    클릭
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    노출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    CTR
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    평균 순위
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    추이 (노출)
                  </th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((row) => (
                  <tr
                    key={row.query}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[200px] truncate font-medium">
                      {row.query}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtCtr(row.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtPos(row.position)}
                    </td>
                    <td className="px-4 py-3 flex justify-center">
                      <Sparkline data={row.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 인기 페이지 테이블 ────────────────────────────────────────── */}
      {topPages.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold">
              인기 페이지 (최근 28일 · 노출순 상위 {topPages.length}개)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    페이지 경로
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    클릭
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    노출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    CTR
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    평균 순위
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    추이 (노출)
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((row) => (
                  <tr
                    key={row.page_path}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 max-w-[220px] truncate">
                      <a
                        href={row.page_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.page_path}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.clicks.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtCtr(row.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtPos(row.position)}
                    </td>
                    <td className="px-4 py-3 flex justify-center">
                      <Sparkline data={row.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSeoPerformancePage
