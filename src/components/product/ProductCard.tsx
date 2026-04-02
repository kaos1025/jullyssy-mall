import Link from "next/link"
import Image from "next/image"

interface ProductCardProps {
  id: string
  name: string
  price: number
  sale_price: number | null
  thumbnail: string | null
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

const ProductCard = ({
  id,
  name,
  price,
  sale_price,
  thumbnail,
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

  return (
    <Link href={`/products/${slug || id}`} className="group block">
      {/* 이미지 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            이미지 없음
          </div>
        )}

        {/* 품절 오버레이 */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-sm tracking-wider">SOLD OUT</span>
          </div>
        )}

        {/* NEW 뱃지 */}
        {!isSoldOut && isNew(created_at) && (
          <span className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-0.5">
            NEW
          </span>
        )}
      </div>

      {/* 상품 정보 */}
      <div className="mt-3 flex flex-col min-h-[72px]">
        <h3 className="text-sm line-clamp-1">{name}</h3>

        {/* 가격 */}
        <div className="mt-1">
          {sale_price ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground line-through">
                  {price.toLocaleString()}원
                </span>
                <span className="text-sm font-bold">
                  {displayPrice.toLocaleString()}원
                </span>
              </div>
              <span className="text-sm text-primary font-bold">
                -{discountRate}%
              </span>
            </>
          ) : (
            <span className="text-sm font-medium">
              {displayPrice.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 리뷰 별점 */}
        {review_count > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            ★ {review_avg != null ? review_avg.toFixed(1) : "-"} ({review_count})
          </p>
        )}
      </div>
    </Link>
  )
}

export default ProductCard
