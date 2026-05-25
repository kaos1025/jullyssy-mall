import { Resend } from "resend"

// Resend 단일 진입점 — 서버 전용 (Route Handler / Server Component / Server Action에서만 사용)
//
// Lazy init: Resend 생성자는 RESEND_API_KEY 없으면 즉시 throw (Resend SDK 설계).
// preview/dev에서 키 미설정 시에도 모듈 import만으로 throw되면 무관 라우트까지 전염되므로
// 첫 사용 시점에 인스턴스화하고 결과를 캐시.
//
// production은 instrumentation.ts → validateEnv에서 key 누락 시 throw (Layer 1).
// preview/dev는 send.ts runtime guard + 본 함수에서 throw (Layer 2).

let cached: Resend | null = null

export function getResendClient(): Resend {
  if (cached) return cached
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY env 누락 — getResendClient")
  }
  cached = new Resend(apiKey)
  return cached
}
