"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

// 네이버 애널리틱스(WCS) 추적ID — analytics.naver.com 발급. 클라이언트 노출(NEXT_PUBLIC).
const NAVER_ANALYTICS_ID = process.env.NEXT_PUBLIC_NAVER_ANALYTICS_ID

declare global {
  interface Window {
    wcs_add?: Record<string, string>
    wcs?: { inflow?: (domain?: string) => void }
    wcs_do?: (nasa?: unknown) => void
    _nasa?: Record<string, unknown>
  }
}

/**
 * 네이버 애널리틱스(WCS) 페이지뷰 수집.
 * - wcslog.js 로드 후 wcs_do()로 1건 전송. App Router SPA → pathname 전환마다 재전송.
 * - 최초 로드는 스크립트 onLoad가 처리(useEffect 시점엔 wcs_do 미로드 가능).
 * - inflow(유입 출처)는 최초 진입에서만 — SPA 내부 이동을 신규 유입으로 오집계 방지.
 * - 같은 pathname 중복 전송 방지(onLoad↔useEffect 타이밍 경합·StrictMode) ref 가드.
 * - NEXT_PUBLIC_NAVER_ANALYTICS_ID 미설정 시 아무것도 렌더/전송하지 않음.
 */
export const NaverAnalytics = () => {
  const pathname = usePathname()
  const sentPathRef = useRef<string | null>(null)

  const trackPageView = useCallback((path: string, isInitialLoad: boolean) => {
    if (
      !NAVER_ANALYTICS_ID ||
      typeof window === "undefined" ||
      typeof window.wcs_do !== "function"
    ) {
      return
    }
    if (sentPathRef.current === path) return
    sentPathRef.current = path

    if (!window.wcs_add) window.wcs_add = {}
    window.wcs_add["wa"] = NAVER_ANALYTICS_ID
    if (!window._nasa) window._nasa = {}
    if (isInitialLoad) window.wcs?.inflow?.()
    window.wcs_do(window._nasa)
  }, [])

  useEffect(() => {
    trackPageView(pathname, false)
  }, [pathname, trackPageView])

  if (!NAVER_ANALYTICS_ID) return null

  return (
    <Script
      src="https://wcs.naver.net/wcslog.js"
      strategy="afterInteractive"
      onLoad={() => trackPageView(pathname, true)}
    />
  )
}
