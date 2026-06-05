"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { HeroBanner } from "@/lib/hero-banners"

interface Props {
  banners: HeroBanner[]
}

const INTERVAL = 5000
const SWIPE_THRESHOLD = 50

// 기존 자체 캐러셀(setInterval + translateX + 터치스와이프 + 도트) 유지, 데이터만 DB 연동.
const HeroBannerCarousel = ({ banners }: Props) => {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)

  const slideCount = banners.length

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % slideCount) + slideCount) % slideCount)
    },
    [slideCount]
  )

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  // 자동 슬라이드 (단일 배너면 비활성, hover 시 일시정지)
  useEffect(() => {
    if (isPaused || slideCount <= 1) return
    const timer = setInterval(next, INTERVAL)
    return () => clearInterval(timer)
  }, [next, isPaused, slideCount])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }
  const handleTouchEnd = () => {
    if (touchDeltaX.current > SWIPE_THRESHOLD) prev()
    else if (touchDeltaX.current < -SWIPE_THRESHOLD) next()
  }

  return (
    <section
      className="relative w-full h-[40vh] md:h-[400px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 슬라이드 트랙 */}
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner, i) => {
          const hasOverlay = banner.title || banner.subtitle || banner.cta_text
          const overlayContent = (
            <>
              {/* PC 이미지 */}
              <Image
                src={banner.image_url_pc}
                alt={banner.title ?? "메인 배너"}
                fill
                className="object-cover hidden md:block"
                sizes="100vw"
                priority={i === 0}
              />
              {/* 모바일 이미지 */}
              <Image
                src={banner.image_url_mobile}
                alt={banner.title ?? "메인 배너"}
                fill
                className="object-cover md:hidden"
                sizes="100vw"
                priority={i === 0}
              />
              {hasOverlay && (
                <>
                  <div className="absolute inset-0 bg-black/15" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
                    <p className="text-xs tracking-[0.3em] text-white/90 mb-2 drop-shadow">
                      JULLYSSY
                    </p>
                    {banner.title && (
                      <h2 className="font-display text-3xl md:text-5xl tracking-wider mb-2 text-white drop-shadow-md">
                        {banner.title}
                      </h2>
                    )}
                    {banner.subtitle && (
                      <p className="text-sm md:text-base text-white/90 mb-8 drop-shadow">
                        {banner.subtitle}
                      </p>
                    )}
                    {/* CTA 텍스트 없으면 버튼 미렌더 */}
                    {banner.cta_text && (
                      <span className="inline-block bg-white text-foreground rounded-full px-6 py-2 text-sm font-medium">
                        {banner.cta_text} →
                      </span>
                    )}
                  </div>
                </>
              )}
            </>
          )

          return (
            <div key={banner.id} className="relative w-full h-full shrink-0 bg-muted">
              {/* cta_link 있으면 슬라이드 전체를 링크로 (오버레이/이미지 포함) */}
              {banner.cta_link ? (
                <Link
                  href={banner.cta_link}
                  className="block w-full h-full"
                  aria-label={banner.title ?? "메인 배너"}
                >
                  {overlayContent}
                </Link>
              ) : (
                overlayContent
              )}
            </div>
          )
        })}
      </div>

      {/* 좌우 화살표 + 도트 (단일 배너면 숨김) */}
      {slideCount > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center text-foreground/70 hover:bg-white hover:text-foreground transition-all shadow-sm"
            aria-label="이전 슬라이드"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center text-foreground/70 hover:bg-white hover:text-foreground transition-all shadow-sm"
            aria-label="다음 슬라이드"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 h-2 bg-white"
                    : "w-2 h-2 bg-white/50 hover:bg-white/70"
                }`}
                aria-label={`슬라이드 ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default HeroBannerCarousel
