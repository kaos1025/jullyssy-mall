import Script from "next/script"

// Cloudflare Web Analytics 비콘 토큰 — 대시보드 → Analytics & Logs → Web Analytics → 사이트 추가 시 발급.
// 클라이언트 노출(NEXT_PUBLIC). 쿠키/식별자 없이 페이지뷰·Core Web Vitals 만 수집한다.
const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN

/**
 * Cloudflare Web Analytics 비콘. Vercel 을 떠나면서 @vercel/analytics 를 대체한다.
 * - jullyssy.shop 이 Cloudflare 프록시 뒤에 있으면 대시보드에서 자동 주입도 가능하지만,
 *   명시 삽입이 프록시 설정과 무관하게 동작하고 SPA 라우팅(History API) 도 비콘이 자체 추적한다.
 * - NEXT_PUBLIC_CF_BEACON_TOKEN 미설정 시 아무것도 렌더하지 않는다 (로컬/프리뷰).
 */
export const CloudflareAnalytics = () => {
  if (!CF_BEACON_TOKEN) return null

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
      strategy="afterInteractive"
    />
  )
}
