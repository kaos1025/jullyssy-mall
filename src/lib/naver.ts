import bcrypt from "bcryptjs"
import { fetch as undiciFetch, ProxyAgent } from "undici"
import type { RequestInit as UndiciRequestInit } from "undici"

const NAVER_API_BASE = "https://api.commerce.naver.com/external"

export { NAVER_API_BASE }

const NAVER_FETCH_TIMEOUT_MS = 15_000

// 호출 시점 lazy 초기화 — module 로드 시 ProxyAgent를 생성하지 않음(Resend 패턴 준용).
// NAVER_PROXY_URL 미설정 시 undefined → undici가 직결(dispatcher 없음).
let cachedDispatcher: ProxyAgent | undefined
let dispatcherResolved = false
const getNaverDispatcher = (): ProxyAgent | undefined => {
  if (!dispatcherResolved) {
    const url = process.env.NAVER_PROXY_URL?.trim()
    cachedDispatcher = url ? new ProxyAgent(url) : undefined
    dispatcherResolved = true
  }
  return cachedDispatcher
}

/**
 * 모든 네이버 커머스 API 호출에 사용하는 fetch 래퍼.
 * - NAVER_PROXY_URL 설정 시 undici ProxyAgent(VPS 고정IP)를 통해 발송.
 * - 미설정 시 직결(로컬 개발 / IP 화이트리스트 직접 등록 환경).
 * - Next.js global fetch 패칭을 우회하기 위해 undici를 직접 사용.
 * - token 인자가 있으면 Authorization: Bearer 헤더를 자동 주입.
 * - 단일 호출 timeout: NAVER_FETCH_TIMEOUT_MS(15s).
 */
export const naverFetch = (
  url: string,
  init: Omit<UndiciRequestInit, "dispatcher" | "signal"> = {},
  token?: string,
) =>
  undiciFetch(url, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
    dispatcher: getNaverDispatcher(),
    signal: AbortSignal.timeout(NAVER_FETCH_TIMEOUT_MS),
  } satisfies UndiciRequestInit)

export const getNaverAccessToken = async () => {
  const clientId = process.env.NAVER_COMMERCE_APP_ID?.trim()
  const clientSecret = process.env.NAVER_COMMERCE_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error("네이버 커머스 API 환경변수가 설정되지 않았습니다")
  }

  // bcrypt 서명 생성 (네이버 커머스 API 스펙)
  // clientSecret은 네이버가 발급한 bcrypt salt ($2a$... 형태)
  const timestamp = Date.now()
  const password = `${clientId}_${timestamp}`
  const hashed = bcrypt.hashSync(password, clientSecret)
  const clientSecretSign = Buffer.from(hashed).toString("base64")

  // 토큰 엔드포인트도 naverFetch 경유(프록시 통과). token 인자 없음 — 인증은 body로.
  const res = await naverFetch(`${NAVER_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      timestamp: String(timestamp),
      client_secret_sign: clientSecretSign,
      grant_type: "client_credentials",
      type: "SELF",
    }),
  })

  const data = (await res.json()) as Record<string, string>
  if (!res.ok) {
    throw new Error(`네이버 인증 실패: ${data.error || data.message || JSON.stringify(data)}`)
  }
  return data.access_token
}
