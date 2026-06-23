// GSC 클라이언트 순수 헬퍼 함수 (단위 테스트 대상).
// 런타임 의존성 없음(타입 전용 import만). 모든 함수 export.
import type { GscRow } from "./client"
import type { GscQueryMetric, GscPageMetric } from "@/types/gsc"

/**
 * Vercel env에 `\n` 리터럴로 저장된 private_key 개행 복원.
 * 이미 실제 개행이 있으면 그대로 반환.
 */
export const restorePrivateKey = (raw: string): string => {
  // 실제 개행이 이미 있으면(-----BEGIN 이후 첫 \n이 진짜) 변환 불필요
  if (raw.includes("\n")) return raw
  return raw.replace(/\\n/g, "\n")
}

/**
 * 전체 URL(https://jullyssy.shop/products/x) 또는 경로(/products/x)를
 * pathname만으로 정규화. 쿼리스트링·해시 제거.
 * 선행 슬래시 보장. 후행 슬래시 유지(GSC가 구별하므로 건드리지 않음).
 */
export const stripToPath = (urlOrPath: string): string => {
  // 프로토콜이 있으면 URL 파싱
  if (/^https?:\/\//i.test(urlOrPath)) {
    try {
      const parsed = new URL(urlOrPath)
      return parsed.pathname
    } catch {
      // URL 파싱 실패 시 fallback to string processing
    }
  }
  // 경로만 있는 경우: 쿼리스트링 및 해시 제거
  const withoutQuery = urlOrPath.split("?")[0].split("#")[0]
  // 선행 슬래시 보장
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`
}

/**
 * Date → YYYY-MM-DD (UTC 기준).
 */
export const toGscDate = (d: Date): string => {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * 트레일링 윈도우 날짜 범위 계산.
 * endDate = today - 1일 (GSC는 어제까지 유효)
 * startDate = today - days일
 *
 * @param today 기준일 (보통 new Date())
 * @param days 윈도우 크기 (예: 5)
 */
export const trailingWindow = (
  today: Date,
  days: number,
): { startDate: string; endDate: string } => {
  const msPerDay = 86_400_000
  const todayMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  )
  const endDate = toGscDate(new Date(todayMs - msPerDay))
  const startDate = toGscDate(new Date(todayMs - days * msPerDay))
  return { startDate, endDate }
}

/**
 * GSC `(other)` 버킷 여부 판정.
 * query 차원에서 상위 N개를 초과한 잔여 트래픽을 GSC가 "(other)"로 집계.
 */
export const isOtherBucket = (key: string): boolean => key === "(other)"

/**
 * GscRow[] (dimensions ['date','query']) → gsc_query_metrics UPSERT 행.
 * keys = [date, query]. data_state는 'all' 고정. 두 cron 라우트 공용.
 */
export const toQueryMetricRows = (
  rows: GscRow[],
  fetchedAt: string,
): GscQueryMetric[] =>
  rows.map((r) => ({
    date: r.keys[0],
    query: r.keys[1],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    data_state: "all",
    fetched_at: fetchedAt,
  }))

/**
 * GscRow[] (dimensions ['date','page']) → gsc_page_metrics UPSERT 행.
 * keys = [date, page]. page는 stripToPath로 경로만. 두 cron 라우트 공용.
 */
export const toPageMetricRows = (
  rows: GscRow[],
  fetchedAt: string,
): GscPageMetric[] =>
  rows.map((r) => ({
    date: r.keys[0],
    page_path: stripToPath(r.keys[1]),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
    data_state: "all",
    fetched_at: fetchedAt,
  }))
