import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "./redis"

/**
 * 라우트 그룹별 rate limit 인스턴스.
 *
 * 한도 결정 근거:
 * - payments: Toss 콜백 재시도 충돌 방지를 위한 여유 (10/min)
 * - auth: OAuth callback redirect chain 흡수 (20/min)
 * - admin: 와이프 운영자 단일 IP 대량 작업 허용 (60/min)
 * - reviews: 작성 스팸 방지 (5/min)
 * - orders: 가짜 주문 생성 방지 (10/min)
 * - coupons: 쿠폰 어뷰징 방지 (3/min)
 *
 * sliding window: 시간 경계 폭증 방지 (fixed window 대비 더 정확한 한도 적용).
 *
 * isRateLimitEnabled === false 환경에서 redis === null이면 모든 limiter도 null.
 * withRateLimit HOF에서 null 체크 후 fail-open.
 *
 * Reference:
 * - https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms#sliding-window
 */

const createLimiter = (
  identifier: string,
  requests: number,
  windowSec: number
): Ratelimit | null => {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSec} s`),
    prefix: `rl:${identifier}`,
    analytics: false, // Upstash 분석 옵트아웃 (PIPA 위탁 최소화)
  })
}

export const paymentsLimiter = createLimiter("payments", 10, 60)
export const authLimiter = createLimiter("auth", 20, 60)
export const adminLimiter = createLimiter("admin", 60, 60)
export const reviewsLimiter = createLimiter("reviews", 5, 60)
export const ordersLimiter = createLimiter("orders", 10, 60)
export const couponsLimiter = createLimiter("coupons", 3, 60)
