"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Slide {
  title: string
  subtitle: string
  cta: string
  href: string
  gradient: string
}

const slides: Slide[] = [
  {
    title: "SPRING COLLECTION",
    subtitle: "2025 S/S 신상품 컬렉션",
    cta: "컬렉션 보기",
    href: "/products?sort=newest",
    gradient: "from-rose-100 via-pink-50 to-amber-50",
  },
  {
    title: "BEST SELLERS",
    subtitle: "가장 사랑받는 인기 아이템",
    cta: "베스트 보기",
    href: "/products?sort=popular",
    gradient: "from-stone-200 via-stone-100 to-neutral-50",
  },
  {
    title: "FREE SHIPPING",
    subtitle: "5만원 이상 구매 시 무료배송",
    cta: "쇼핑하기",
    href: "/products",
    gradient: "from-sky-100 via-blue-50 to-indigo-50",
  },
]

const HeroBanner = () => {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length)
  }, [])

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length)
  }, [])

  useEffect(() => {
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next])

  const slide = slides[current]

  return (
    <section className="relative w-full h-[40vh] md:h-[400px] overflow-hidden">
      {/* Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} transition-all duration-700`}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
        <p className="text-xs md:text-sm tracking-[0.3em] text-muted-foreground mb-3">
          JULLYSSY
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
          {slide.title}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground mb-8">
          {slide.subtitle}
        </p>
        <Link
          href={slide.href}
          className="inline-block border border-foreground px-8 py-3 text-sm font-medium tracking-wider hover:bg-foreground hover:text-background transition-colors"
        >
          {slide.cta}
        </Link>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 text-muted-foreground/60 hover:text-foreground transition-colors"
        aria-label="이전 슬라이드"
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 text-muted-foreground/60 hover:text-foreground transition-colors"
        aria-label="다음 슬라이드"
      >
        <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-[2px] transition-all duration-300 ${
              i === current ? "w-8 bg-foreground" : "w-4 bg-foreground/30"
            }`}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </section>
  )
}

export default HeroBanner
