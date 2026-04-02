"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface HeroSlide {
  image: { desktop: string; mobile: string }
  title: string
  subtitle: string
  link: string
  bgClass: string
}

const heroSlides: HeroSlide[] = [
  {
    image: { desktop: "", mobile: "" },
    title: "SPRING COLLECTION",
    subtitle: "2025 S/S 신상품 컬렉션",
    link: "/products?sort=newest",
    bgClass: "bg-gradient-to-r from-primary/20 to-accent/20",
  },
  {
    image: { desktop: "", mobile: "" },
    title: "NEW ARRIVAL",
    subtitle: "매주 업데이트되는 신상품",
    link: "/products?sort=newest",
    bgClass: "bg-gradient-to-r from-secondary to-warm",
  },
  {
    image: { desktop: "", mobile: "" },
    title: "WEEKLY BEST",
    subtitle: "이번 주 가장 사랑받는 아이템",
    link: "/products?sort=popular",
    bgClass: "bg-gradient-to-r from-accent/20 to-primary/20",
  },
]

const INTERVAL = 5000
const SWIPE_THRESHOLD = 50

const HeroBanner = () => {
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const touchStartX = useRef(0)
  const touchDeltaX = useRef(0)

  const slideCount = heroSlides.length

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % slideCount) + slideCount) % slideCount)
    },
    [slideCount]
  )

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  // 자동 슬라이드 (hover 시 일시정지)
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(next, INTERVAL)
    return () => clearInterval(timer)
  }, [next, isPaused])

  // 터치 이벤트
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
        {heroSlides.map((s, i) => {
          const hasImg = s.image.desktop || s.image.mobile
          return (
            <div
              key={i}
              className={`relative w-full h-full shrink-0 ${!hasImg ? s.bgClass : ""}`}
            >
              {/* 실제 이미지가 있으면 표시 */}
              {hasImg && (
                <>
                  {/* 데스크톱 이미지 */}
                  {s.image.desktop && (
                    <Image
                      src={s.image.desktop}
                      alt={s.title}
                      fill
                      className="object-cover hidden md:block"
                      sizes="100vw"
                      priority={i === 0}
                    />
                  )}
                  {/* 모바일 이미지 */}
                  {s.image.mobile && (
                    <Image
                      src={s.image.mobile}
                      alt={s.title}
                      fill
                      className="object-cover md:hidden"
                      sizes="100vw"
                      priority={i === 0}
                    />
                  )}
                  {/* 이미지 위 오버레이 */}
                  <div className="absolute inset-0 bg-black/10" />
                </>
              )}

              {/* 텍스트 콘텐츠 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10">
                <p className="text-xs tracking-[0.3em] text-muted-foreground/80 mb-2">
                  JULLYSSY
                </p>
                <h2 className="font-display text-3xl md:text-5xl tracking-wider mb-2">
                  {s.title}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground mb-8">
                  {s.subtitle}
                </p>
                <Link
                  href={s.link}
                  className="inline-block bg-white text-foreground rounded-full px-6 py-2 text-sm font-medium hover:bg-foreground hover:text-white transition-colors"
                >
                  쇼핑하기 →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* 좌우 화살표 */}
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

      {/* 도트 페이지네이션 */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {heroSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 h-2 bg-foreground"
                : "w-2 h-2 bg-foreground/30 hover:bg-foreground/50"
            }`}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </section>
  )
}

export default HeroBanner
