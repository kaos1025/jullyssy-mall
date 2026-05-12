import type { Ratelimit } from "@upstash/ratelimit"
import { getClientIp } from "./getClientIp"
import { rateLimitErrorResponse } from "./handleRateLimitError"

// Request 타입과 dynamic route params 인자를 모두 통과시키기 위해 generic 사용.
// NextRequest 핸들러 + { params } 시그니처를 그대로 받아 wrapper 결과도 동일 시그니처로 노출.
type RouteHandler<
  TReq extends Request = Request,
  TArgs extends unknown[] = unknown[],
> = (request: TReq, ...args: TArgs) => Promise<Response>

/**
 * 식별자 마스킹 (로그 노출 최소화).
 * IPv4는 마지막 옥텟 마스킹, 그 외는 앞 8자리만.
 */
const maskIdentifier = (id: string): string => {
  if (id === "anonymous") return "anonymous"
  if (/^\d+\.\d+\.\d+\.\d+$/.test(id)) {
    return id.replace(/\.\d+$/, ".***")
  }
  if (id.length <= 8) return "***"
  return `${id.slice(0, 8)}***`
}

/**
 * Rate limit HOF. Route handler를 감싸서 limiter hit 시 429 반환.
 *
 * 식별자 정책:
 * - identifier 콜백 우선 (로그인 사용자 userId 등 라우트별 커스텀)
 * - 폴백: getClientIp(request)
 *
 * Fail-open 정책:
 * - limiter === null (preview/dev/Redis 미설정) → 통과
 * - limiter.limit() throw (Redis 통신 장애) → 통과 + console.warn
 * - 보안보다 가용성 우선. 결제/주문이 Redis 장애로 차단되면 사용자 피해 더 큼.
 *
 * Sentry 통합은 main 베이스라 console.warn 임시 사용.
 * TODO(rate-limit-rebase): Sentry.captureMessage로 교체.
 */
export const withRateLimit = <
  TReq extends Request,
  TArgs extends unknown[],
>(
  limiter: Ratelimit | null,
  handler: RouteHandler<TReq, TArgs>,
  options?: {
    identifier?: (request: TReq) => Promise<string> | string
  }
): RouteHandler<TReq, TArgs> => {
  return async (request, ...args) => {
    if (!limiter) {
      return handler(request, ...args)
    }

    let id: string
    try {
      id = options?.identifier
        ? await options.identifier(request)
        : getClientIp(request)
    } catch {
      id = getClientIp(request)
    }

    try {
      const { success, limit, remaining, reset } = await limiter.limit(id)

      if (!success) {
        const resetSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
        console.warn(
          `[rate-limit] hit: identifier=${maskIdentifier(id)} limit=${limit} remaining=${remaining}`
        )
        // TODO(rate-limit-rebase): replace with Sentry.captureMessage("rate_limit_hit", { level: "warning", tags: { identifier_masked: maskIdentifier(id) } })
        return rateLimitErrorResponse(resetSec)
      }

      return handler(request, ...args)
    } catch (error) {
      // Redis 통신 장애 → fail-open
      console.warn(
        `[rate-limit] redis error, failing open: ${error instanceof Error ? error.message : "unknown"}`
      )
      // TODO(rate-limit-rebase): replace with Sentry.captureMessage("rate_limit_redis_error", { level: "warning" })
      return handler(request, ...args)
    }
  }
}
