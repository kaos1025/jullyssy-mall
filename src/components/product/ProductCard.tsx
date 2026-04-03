"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, ShoppingBag } from "lucide-react"

interface ProductCardProps {
  id: string
  name: string
  price: number
  sale_price: number | null
  thumbnail: string | null
  images?: string[]
  colors?: string[]
  review_count?: number
  review_avg?: number | null
  slug?: string | null
  status?: string
  created_at?: string
}

const isNew = (createdAt?: string) => {
  if (!createdAt) return false
  const diff = Date.now() - new Date(createdAt).getTime()
  return diff < 7 * 24 * 60 * 60 * 1000
}

const COLOR_MAP: Record<string, string> = {
  블랙: "#000000",
  black: "#000000",
  화이트: "#FFFFFF",
  white: "#FFFFFF",
  아이보리: "#D4C5B0",
  ivory: "#D4C5B0",
  베이지: "#C8B99A",
  beige: "#C8B99A",
  크림: "#FFFDD0",
  네이비: "#1B2A4A",
  navy: "#1B2A4A",
  그레이: "#888888",
  gray: "#888888",
  회색: "#888888",
  카키: "#6B7B5E",
  khaki: "#6B7B5E",
  올리브: "#6B7B5E",
  브라운: "#8B6914",
  brown: "#8B6914",
  연브라운: "#B8956A",
  진브라운: "#5C3A1E",
  카멜: "#C19A6B",
  camel: "#C19A6B",
  와인: "#722F37",
  wine: "#722F37",
  레드: "#D94B4B",
  red: "#D94B4B",
  핑크: "#E8A0BF",
  pink: "#E8A0BF",
  연핑크: "#F5C6D0",
  블루: "#4A7EB5",
  blue: "#4A7EB5",
  스카이블루: "#87CEEB",
  라벤더: "#B8A9C9",
  퍼플: "#7B4F8A",
  그린: "#5A8F5A",
  green: "#5A8F5A",
  민트: "#98D8C8",
  오렌지: "#E87F3A",
  옐로우: "#E8C84A",
  yellow: "#E8C84A",
  차콜: "#36454F",
  charcoal: "#36454F",
  라이트그레이: "#C0C0C0",
  딥그린: "#2E5A3E",
  머스타드: "#C9A832",
}

const getColorHex = (colorName: string) =>
  COLOR_MAP[colorName.toLowerCase()] ?? COLOR_MAP[colorName] ?? "#D1D5DB"

const ProductCard = ({
  id,
  name,
  price,
  sale_price,
  thumbnail,
  images = [],
  colors = [],
  review_count = 0,
  review_avg,
  slug,
  status,
  created_at,
}: ProductCardProps) => {
  const discountRate = sale_price
    ? Math.round(((price - sale_price) / price) * 100)
    : 0
  const displayPrice = sale_price ?? price
  const isSoldOut = status === "SOLDOUT"

  const primaryImage = thumbnail || images[0] || null
  const hoverImage = images[1] || null
  const displayColors = colors.slice(0, 5)

  return (
    <article className="group">
    <Link href={`/products/${slug || id}`} className="block">
      {/* 이미지 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {primaryImage ? (
          <>
            <Image
              src={primaryImage}
              alt={name}
              fill
              className={`object-cover transition-all duration-500 group-hover:scale-105 ${
                hoverImage ? "group-hover:opacity-0" : ""
              }`}
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={`${name} hover`}
                fill
                className="object-cover transition-all duration-500 opacity-0 group-hover:opacity-100 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            이미지 없음
          </div>
        )}

        {/* 품절 오버레이 */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <span className="text-white font-bold text-sm tracking-wider">
              SOLD OUT
            </span>
          </div>
        )}

        {/* 뱃지 */}
        {!isSoldOut && (
          <>
            {/* NEW 뱃지 — 좌측 상단 */}
            {isNew(created_at) && (
              <span className="absolute top-2 left-2 z-10 bg-badge-new text-white text-[10px] font-bold px-2 py-0.5 rounded-sm">
                NEW
              </span>
            )}
            {/* 할인율 뱃지 — 우측 상단 */}
            {discountRate > 0 && (
              <span className="absolute top-2 right-2 z-10 bg-destructive text-white text-[10px] font-bold w-9 h-9 rounded-full flex items-center justify-center">
                -{discountRate}%
              </span>
            )}
          </>
        )}

        {/* hover 시 찜/장바구니 아이콘 */}
        {!isSoldOut && (
          <div className="absolute bottom-2 right-2 z-10 flex gap-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <button
              onClick={(e) => {
                e.preventDefault()
                // TODO: 찜 기능
              }}
              className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
              aria-label="찜하기"
            >
              <Heart className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                // TODO: 빠른 장바구니 추가
              }}
              className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
              aria-label="장바구니"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* 상품 정보 */}
      <div className="mt-2.5 flex flex-col min-h-[90px]">
        {/* 가격 */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {sale_price ? (
            <>
              <span className="text-sm font-bold text-destructive">
                {discountRate}%
              </span>
              <span className="text-xs text-muted-foreground line-through">
                {price.toLocaleString()}
              </span>
              <span className="text-sm font-bold">
                {displayPrice.toLocaleString()}원
              </span>
            </>
          ) : (
            <span className="text-sm font-bold">
              {displayPrice.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 상품명 */}
        <h3 className="text-sm text-foreground/80 mt-1 line-clamp-2 leading-snug">
          {name}
        </h3>

        {/* 컬러칩 */}
        {displayColors.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {displayColors.map((color) => (
              <span
                key={color}
                className="inline-block w-[10px] h-[10px] rounded-full border border-border/60"
                style={{ backgroundColor: getColorHex(color) }}
                title={color}
              />
            ))}
            {colors.length > 5 && (
              <span className="text-[10px] text-muted-foreground ml-0.5">
                +{colors.length - 5}
              </span>
            )}
          </div>
        )}

        {/* 리뷰 */}
        {review_count > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            ★ {review_avg != null ? review_avg.toFixed(1) : "-"} ({review_count})
          </p>
        )}
      </div>
    </Link>
    </article>
  )
}

export default ProductCard
