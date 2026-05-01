"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import type { TopBanner } from "@/lib/banners"

interface Props {
  banners: TopBanner[]
}

const VARIANT_DEFAULTS = {
  normal: { bg: "#1F2937", text: "#FFFFFF" },
  urgent: { bg: "#DC2626", text: "#FFFFFF" },
} as const

const getBannerStyle = (banner: TopBanner): React.CSSProperties => {
  const variantKey =
    banner.variant === "urgent" ? "urgent" : "normal"
  const defaults = VARIANT_DEFAULTS[variantKey]
  return {
    backgroundColor: banner.bg_color || defaults.bg,
    color: banner.text_color || defaults.text,
  }
}

const BannerContent = ({
  banner,
  withIndicatorPadding = false,
}: {
  banner: TopBanner
  withIndicatorPadding?: boolean
}) => {
  const inner = (
    <div
      className={`flex items-center justify-center gap-2 h-9 px-4 text-xs sm:text-sm ${
        withIndicatorPadding ? "pr-20" : ""
      }`}
      style={getBannerStyle(banner)}
    >
      {banner.emoji && <span aria-hidden="true">{banner.emoji}</span>}
      <span className="truncate">{banner.message}</span>
    </div>
  )

  if (banner.link_url) {
    return (
      <Link
        href={banner.link_url}
        className="block hover:opacity-90 transition-opacity"
      >
        {inner}
      </Link>
    )
  }
  return inner
}

const TopBannerCarouselMulti = ({ banners }: { banners: TopBanner[] }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)

    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const autoplayRef = useRef(
    Autoplay({
      delay: 5000,
      stopOnInteraction: false,
      stopOnMouseEnter: true,
      stopOnFocusIn: true,
    })
  )

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "center",
    },
    prefersReducedMotion ? [] : [autoplayRef.current]
  )

  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on("select", onSelect)
    return () => {
      emblaApi.off("select", onSelect)
    }
  }, [emblaApi, onSelect])

  const scrollTo = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index)
    },
    [emblaApi]
  )

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="공지 배너"
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {banners.map((banner, i) => (
            <div
              key={banner.id}
              className="flex-[0_0_100%] min-w-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${banners.length}`}
            >
              <BannerContent banner={banner} withIndicatorPadding />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1.5">
        {banners.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`배너 ${i + 1} / ${banners.length}로 이동`}
            aria-current={selectedIndex === i}
            className={`w-1.5 h-1.5 rounded-full transition-opacity ${
              selectedIndex === i
                ? "bg-white opacity-100"
                : "bg-white opacity-40"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

const TopBannerCarousel = ({ banners }: Props) => {
  if (banners.length === 0) return null

  if (banners.length === 1) {
    return (
      <div role="region" aria-label="공지 배너">
        <BannerContent banner={banners[0]} />
      </div>
    )
  }

  return <TopBannerCarouselMulti banners={banners} />
}

export default TopBannerCarousel
