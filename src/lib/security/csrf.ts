import { type NextRequest } from "next/server"

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"]

// 토스 webhook은 외부 서버에서 Origin 없이 호출 → CSRF 면제
// payment_secret 기반 HMAC 검증으로 별도 보호됨 (commit 0d5dd67)
//
// /api/dev/* — preview 환경 자동화 검증 (이메일 발송 테스트 등). production에서는
// VERCEL_ENV === "production" 차단으로 라우트 자체가 404, 별도 헤더 인증(x-resend-key 등)으로 보호.
//
// /api/cron/shipping-poll — pg_cron + pg_net이 Origin 헤더 없이 POST 호출 → webhook과 동일하게 CSRF 면제.
// 라우트는 Bearer CRON_SECRET으로 보호되고 쿠키/세션을 쓰지 않는다(ambient-credential 부재) →
// CSRF(브라우저 위조 방지)는 구조적으로 무관하므로 면제가 보호를 약화시키지 않는다.
// 면제 범위 최소화: prefix가 아니라 경로별 명시 추가(신규 cron 라우트는 개별 등록).
//
// /api/cron/gsc-sync, /api/cron/gsc-backfill — 신규 GSC 동기화 cron 라우트.
// shipping-poll과 동일: pg_net이 Origin 없이 POST 호출 + Bearer CRON_SECRET 보호 + 세션 미사용 →
// 같은 근거로 CSRF 면제(개별 경로 명시).
//
// /api/cron/naver-sync — 신규 네이버 재고/상태 동기화 cron 라우트. pg_net이 Origin 없이
// POST 호출 + Bearer CRON_SECRET 보호 + 세션 미사용 → 같은 근거로 CSRF 면제(개별 경로 명시).
const CSRF_EXEMPT_PATHS = [
  "/api/payments/webhook",
  "/api/dev/",
  "/api/cron/shipping-poll",
  "/api/cron/gsc-sync",
  "/api/cron/gsc-backfill",
  "/api/cron/naver-sync",
]

const PRODUCTION_ORIGINS = [
  "https://jullyssy.shop",
  "https://www.jullyssy.shop",
]

const PREVIEW_HOSTNAME_PATTERNS = [/\.vercel\.app$/]

export type CsrfResult = { ok: true } | { ok: false; reason: string }

const isCsrfEnforced = () => {
  const env = process.env.VERCEL_ENV
  return env === "production" || env === "preview"
}

export const isCsrfExempt = (pathname: string) =>
  CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path))

export const isOriginAllowed = (origin: string) => {
  if (PRODUCTION_ORIGINS.includes(origin)) return true

  if (process.env.VERCEL_ENV === "preview") {
    try {
      const hostname = new URL(origin).hostname
      return PREVIEW_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))
    } catch {
      return false
    }
  }

  return false
}

export const verifyCsrf = (request: NextRequest): CsrfResult => {
  const method = request.method.toUpperCase()
  if (!STATE_CHANGING_METHODS.includes(method)) return { ok: true }

  const { pathname } = request.nextUrl
  if (isCsrfExempt(pathname)) return { ok: true }

  // development: fail-open (Day 15 rate-limit과 동일 정책)
  if (!isCsrfEnforced()) return { ok: true }

  const origin = request.headers.get("origin")
  if (origin) {
    if (isOriginAllowed(origin)) return { ok: true }
    return { ok: false, reason: `origin not allowed: ${origin}` }
  }

  const referer = request.headers.get("referer")
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (isOriginAllowed(refererOrigin)) return { ok: true }
      return { ok: false, reason: `referer not allowed: ${refererOrigin}` }
    } catch {
      return { ok: false, reason: `invalid referer: ${referer}` }
    }
  }

  return { ok: false, reason: "no origin or referer header" }
}
