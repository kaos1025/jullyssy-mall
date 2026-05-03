import { NextResponse } from "next/server"

/**
 * Sentry 통합 검증용 일회성 테스트 라우트.
 * Phase 9에서 Vercel preview 환경에서 한 번 호출 후 Phase 10에서 삭제 예정.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  throw new Error("Sentry integration test - safe to ignore")
  return NextResponse.json({ ok: true })
}
