import { Redis } from "@upstash/redis"
import { isRateLimitEnabled, kvRestApiUrl, kvRestApiToken } from "@/lib/env"

/**
 * Upstash Redis 인스턴스 (Vercel Marketplace 통합).
 *
 * isRateLimitEnabled === false (preview/dev/누락) 환경에서는 null 반환.
 * 호출부에서 null 체크 후 fail-open (rate limit 통과 처리).
 *
 * Why fail-open?
 * - rate limit은 보안 강화 레이어이지, 핵심 서비스 가용성보다 우선되지 않음
 * - Redis 통신 장애 시 결제 confirm이 차단되면 사용자 피해가 더 큼
 * - production 변수 누락 시에는 instrumentation에서 throw되므로 여기 도달 안 함
 *
 * Reference:
 * - https://upstash.com/docs/redis/howto/vercelintegration
 * - Vercel Marketplace Upstash 통합 변수명은 KV_* (구 Vercel KV 호환)
 */
export const redis: Redis | null = isRateLimitEnabled
  ? new Redis({
      url: kvRestApiUrl,
      token: kvRestApiToken,
    })
  : null
