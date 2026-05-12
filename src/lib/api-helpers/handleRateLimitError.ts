import { NextResponse } from "next/server"

/**
 * 429 Too Many Requests 응답.
 *
 * @param resetSec - sliding window 초기화까지 남은 초 (Retry-After 헤더용)
 */
export const rateLimitErrorResponse = (resetSec: number): NextResponse => {
  return NextResponse.json(
    {
      error: "RATE_LIMITED",
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfter: resetSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetSec),
      },
    }
  )
}
