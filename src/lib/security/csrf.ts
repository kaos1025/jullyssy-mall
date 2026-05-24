import { type NextRequest } from "next/server"

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"]

// 토스 webhook은 외부 서버에서 Origin 없이 호출 → CSRF 면제
// payment_secret 기반 HMAC 검증으로 별도 보호됨 (commit 0d5dd67)
//
// /api/dev/* — preview 환경 자동화 검증 (이메일 발송 테스트 등). production에서는
// VERCEL_ENV === "production" 차단으로 라우트 자체가 404, 별도 헤더 인증(x-resend-key 등)으로 보호.
const CSRF_EXEMPT_PATHS = ["/api/payments/webhook", "/api/dev/"]

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
