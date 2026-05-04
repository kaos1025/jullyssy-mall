/**
 * 요청 헤더에서 클라이언트 IP 추출 (rate limit identifier용).
 *
 * 우선순위:
 * 1. x-forwarded-for 첫 IP (Vercel이 원본 클라이언트 IP를 여기에 셋)
 * 2. x-real-ip (일부 프록시 환경)
 * 3. "anonymous" 폴백
 *
 * 헤더 누락 시 throw 대신 "anonymous" 반환 — rate limit은 키를 항상
 * 보장해야 하지 요청 자체를 깨서는 안 됨 (fail-open 일관성).
 */
export const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim()
    if (firstIp) return firstIp
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()

  return "anonymous"
}
