import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

interface ProductCardProps {
  id: string
  name: string
  price: number
  sale_price: number | null
  thumbnail: string | null
  review_count?: number
  slug?: string | null
}

const ProductCard = ({
  id,
  name,
  price,
  sale_price,
  thumbnail,
  review_count = 0,
  slug,
}: ProductCardProps) => {
  const discountRate = sale_price
    ? Math.round(((price - sale_price) / price) * 100)
    : 0
  const displayPrice = sale_price ?? price

  return (
    <Link href={`/products/${slug || id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            이미지 없음
          </div>
        )}
        {discountRate > 0 && (
          <Badge className="absolute top-2 left-2" variant="destructive">
            {discountRate}%
          </Badge>
        )}
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {name}
        </h3>
        <div className="flex items-center gap-2">
          {sale_price && (
            <span className="text-xs text-muted-foreground line-through">
              {price.toLocaleString()}원
            </span>
          )}
          <span className="text-sm font-bold">
            {displayPrice.toLocaleString()}원
          </span>
        </div>
        {review_count > 0 && (
          <p className="text-xs text-muted-foreground">
            리뷰 {review_count}
          </p>
        )}
      </div>
    </Link>
  )
}

export default ProductCard
