// GSC REST API 클라이언트.
// google-auth-library (경량) + fetch 직접 호출. googleapis 패키지 회피.
//
// Lazy init 원칙 (feedback_resend_lazy_init 패턴):
//   GoogleAuth 인스턴스화·env 읽기는 모두 호출 시점에. 모듈 최상단 금지.
//   → validateEnv required 목록 미추가. Phase 0 전 빌드 영향 없음.

import { GoogleAuth } from "google-auth-library"
import { restorePrivateKey } from "./helpers"

// 단일 GSC HTTP 호출 wall-clock 상한. 초과 시 fetch가 AbortError throw →
// URL 검사는 호출부에서 건별 격리, 검색성과는 핸들러 catch. 한 호출이 함수 전체를 멈추지 않게
// (순차 URL 검사가 maxDuration 120s를 넘겨 504 나던 결함의 1차 방어선).
const GSC_REQUEST_TIMEOUT_MS = 15_000
// OAuth 토큰 발급 상한. google-auth-library는 AbortSignal 미지원이라 토큰 발급이 멈추면
// fetch 타임아웃·예산 가드를 모두 우회한다 → 유일하게 남은 무제한 경로를 race로 차단.
const GSC_AUTH_TIMEOUT_MS = 10_000

// Promise에 wall-clock 상한 부여(AbortSignal 못 거는 경로용). 정상 완료 시 타이머 정리.
const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} ${ms}ms 타임아웃 초과`)),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// ---------------------------------------------------------------------------
// 공개 타입
// ---------------------------------------------------------------------------

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchAnalyticsQueryParams {
  siteUrl: string
  accessToken: string
  startDate: string
  endDate: string
  dimensions: string[]
  /** 기본값 25000 (GSC 최대). 페이지네이션 종료 조건에도 사용. */
  rowLimit?: number
  dataState?: "all" | "final"
}

export interface UrlInspectParams {
  siteUrl: string
  accessToken: string
  inspectionUrl: string
}

export interface UrlInspectResult {
  verdict: string | null
  coverageState: string | null
  indexingState: string | null
  lastCrawlTime: string | null
  crawledAs: string | null
}

// ---------------------------------------------------------------------------
// 인증
// ---------------------------------------------------------------------------

/**
 * 서비스 계정 자격증명으로 Google OAuth 2.0 access token 발급.
 *
 * MUST throw at call-time (no module-level instantiation).
 * 필요한 env: GOOGLE_SA_CLIENT_EMAIL, GOOGLE_SA_PRIVATE_KEY
 */
export const getAccessToken = async (): Promise<string> => {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL
  const privateKeyRaw = process.env.GOOGLE_SA_PRIVATE_KEY

  if (!clientEmail) {
    throw new Error(
      "GOOGLE_SA_CLIENT_EMAIL env 누락 — GSC 인증 불가 (getAccessToken)",
    )
  }
  if (!privateKeyRaw) {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY env 누락 — GSC 인증 불가 (getAccessToken)",
    )
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: restorePrivateKey(privateKeyRaw),
    },
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  })

  // getClient + getAccessToken을 단일 10s 예산으로 race(무제한 OAuth 행 차단).
  const token = await withTimeout(
    (async () => {
      const client = await auth.getClient()
      const tokenResponse = await client.getAccessToken()
      return tokenResponse.token
    })(),
    GSC_AUTH_TIMEOUT_MS,
    "GSC access token 발급",
  )

  if (!token) {
    throw new Error("GSC access token 발급 실패 — token이 null/undefined")
  }
  return token
}

/**
 * GSC 속성 URL 반환 (call-time env 읽기).
 * 예: "sc-domain:jullyssy.shop" 또는 "https://jullyssy.shop/"
 */
export const getSiteUrl = (): string => {
  const siteUrl = process.env.GSC_SITE_URL
  if (!siteUrl) {
    throw new Error("GSC_SITE_URL env 누락 — getSiteUrl")
  }
  return siteUrl
}

// ---------------------------------------------------------------------------
// Search Analytics
// ---------------------------------------------------------------------------

interface GscApiRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

interface GscApiResponse {
  rows?: GscApiRow[]
  error?: { message?: string; code?: number }
}

/**
 * GSC Search Analytics 쿼리 (startRow 페이지네이션 포함).
 *
 * GSC는 nextPageToken을 제공하지 않으므로 `rows.length < rowLimit`로 마지막 페이지 판단.
 * 모든 페이지를 집계해 GscRow[] 반환.
 *
 * `fetchImpl` 주입으로 단위 테스트에서 모킹 가능.
 */
export const searchAnalyticsQuery = async (
  params: SearchAnalyticsQueryParams,
  fetchImpl: typeof fetch = fetch,
): Promise<GscRow[]> => {
  const {
    siteUrl,
    accessToken,
    startDate,
    endDate,
    dimensions,
    rowLimit = 25_000,
    dataState,
  } = params

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

  const allRows: GscRow[] = []
  let startRow = 0

  while (true) {
    const body: Record<string, unknown> = {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow,
    }
    if (dataState !== undefined) {
      body.dataState = dataState
    }

    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GSC_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const snippet = await response.text().catch(() => "")
      throw new Error(
        `GSC searchAnalytics 요청 실패: HTTP ${response.status} — ${snippet.slice(0, 200)}`,
      )
    }

    const data = (await response.json()) as GscApiResponse

    const page = (data.rows ?? []).map(
      (r): GscRow => ({
        keys: r.keys ?? [],
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      }),
    )

    allRows.push(...page)

    // GSC는 nextPageToken 없음 — 행수가 rowLimit 미만이면 마지막 페이지
    if (page.length < rowLimit) break

    startRow += rowLimit
  }

  return allRows
}

// ---------------------------------------------------------------------------
// URL Inspection
// ---------------------------------------------------------------------------

interface UrlInspectionApiResponse {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string
      coverageState?: string
      indexingState?: string
      lastCrawlTime?: string
      robotsTxtState?: string
      crawledAs?: string
    }
  }
}

/**
 * GSC URL Inspection API 단건 호출.
 *
 * 쿼터: ~2000/day, 600/min. 야간 cron에서 ~20 URL/night 회전.
 * `fetchImpl` 주입으로 단위 테스트에서 모킹 가능.
 */
export const urlInspect = async (
  params: UrlInspectParams,
  fetchImpl: typeof fetch = fetch,
): Promise<UrlInspectResult> => {
  const { siteUrl, accessToken, inspectionUrl } = params

  const endpoint =
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
    signal: AbortSignal.timeout(GSC_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    const snippet = await response.text().catch(() => "")
    throw new Error(
      `GSC urlInspect 요청 실패: HTTP ${response.status} — ${snippet.slice(0, 200)}`,
    )
  }

  const data = (await response.json()) as UrlInspectionApiResponse
  const result = data.inspectionResult?.indexStatusResult

  return {
    verdict: result?.verdict ?? null,
    coverageState: result?.coverageState ?? null,
    indexingState: result?.indexingState ?? null,
    lastCrawlTime: result?.lastCrawlTime ?? null,
    crawledAs: result?.crawledAs ?? null,
  }
}
