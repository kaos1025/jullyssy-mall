import Link from "next/link"
import { getActiveHeroBanners } from "@/lib/hero-banners"
import HeroBannerCarousel from "./HeroBannerCarousel"

// 서버 컴포넌트: 활성 히어로 배너를 캐시 격리 fetch(getActiveHeroBanners) 후
// 클라이언트 캐러셀에 전달. DB 0건이면 gradient fallback으로 graceful degrade.
const HeroBanner = async () => {
  const banners = await getActiveHeroBanners()

  // 빈 상태 fallback: 활성 배너 0건 → gradient placeholder (운영자 콘텐츠 입력 전).
  // 절대 깨진 레이아웃/빈 공간 금지 — 높이/구성 유지.
  if (banners.length === 0) {
    return (
      <section className="relative w-full h-[40vh] md:h-[400px] overflow-hidden bg-gradient-to-r from-primary/20 to-accent/20">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <p className="text-xs tracking-[0.3em] text-muted-foreground/80 mb-2">
            JULLYSSY
          </p>
          <h2 className="font-display text-3xl md:text-5xl tracking-wider mb-2">
            쥴리씨
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-8">
            트렌디한 여성의류 컬렉션
          </p>
          <Link
            href="/products"
            className="inline-block bg-white text-foreground rounded-full px-6 py-2 text-sm font-medium hover:bg-foreground hover:text-white transition-colors"
          >
            쇼핑하기 →
          </Link>
        </div>
      </section>
    )
  }

  return <HeroBannerCarousel banners={banners} />
}

export default HeroBanner
