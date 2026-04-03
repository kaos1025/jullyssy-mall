import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import ProductCard from "@/components/product/ProductCard"
import HeroBanner from "@/components/home/HeroBanner"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "쥴리씨 | 트렌디한 여성의류 온라인 스토어",
  description: "쥴리씨에서 트렌디한 여성의류를 만나보세요.",
  alternates: {
    canonical: "/",
  },
}

const categories = [
  { name: "전체", slug: "" },
  { name: "상의", slug: "top" },
  { name: "하의", slug: "bottom" },
  { name: "아우터", slug: "outer" },
  { name: "원피스/세트", slug: "dress" },
  { name: "가방/악세서리", slug: "acc" },
]

const HomePage = async () => {
  const supabase = await createClient()

  // 신상품 (최신 8개)
  const { data: newProducts } = await supabase
    .from("products")
    .select("*, product_images(url, is_thumbnail, sort_order), product_options(color)")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(8)

  // 인기상품 (판매량 기준 8개)
  const { data: popularProducts } = await supabase
    .from("products")
    .select("*, product_images(url, is_thumbnail, sort_order), product_options(color)")
    .eq("status", "ACTIVE")
    .order("sell_count", { ascending: false })
    .limit(8)

  const getThumbnail = (product: { product_images?: { url: string; is_thumbnail: boolean }[] }) =>
    product.product_images?.find((img) => img.is_thumbnail)?.url
    || product.product_images?.[0]?.url
    || null

  const getImages = (product: { product_images?: { url: string; is_thumbnail: boolean; sort_order?: number }[] }) =>
    (product.product_images ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((img) => img.url)

  const getColors = (product: { product_options?: { color: string }[] }) =>
    Array.from(new Set((product.product_options ?? []).map((o) => o.color)))

  return (
    <div>
      {/* 히어로 배너 */}
      <HeroBanner />

      {/* 카테고리 pill 칩 */}
      <section className="py-8 md:py-10">
        <div className="container">
          <div className="flex md:justify-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={cat.slug ? `/products?category=${cat.slug}` : "/products"}
                className={`inline-block whitespace-nowrap rounded-full px-5 py-2 text-sm transition-colors ${
                  cat.slug === ""
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NEW ARRIVAL */}
      {newProducts && newProducts.length > 0 && (
        <section className="py-16">
          <div className="container">
            <div className="flex items-end justify-between mb-8 md:mb-10">
              <div>
                <h2 className="font-display text-xl md:text-2xl tracking-wider">
                  NEW ARRIVAL
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  지금 막 도착한 신상품
                </p>
              </div>
              <Link
                href="/products?sort=newest"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                더보기 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              {newProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  sale_price={product.sale_price}
                  thumbnail={getThumbnail(product)}
                  images={getImages(product)}
                  colors={getColors(product)}
                  status={product.status}
                  created_at={product.created_at}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WEEKLY BEST */}
      {popularProducts && popularProducts.length > 0 && (
        <section className="py-16 bg-subtle">
          <div className="container">
            <div className="flex items-end justify-between mb-8 md:mb-10">
              <div>
                <h2 className="font-display text-xl md:text-2xl tracking-wider">
                  WEEKLY BEST
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  이번 주 가장 사랑받은
                </p>
              </div>
              <Link
                href="/products?sort=popular"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                더보기 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              {popularProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  sale_price={product.sale_price}
                  thumbnail={getThumbnail(product)}
                  images={getImages(product)}
                  colors={getColors(product)}
                  status={product.status}
                  created_at={product.created_at}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 프로모션 배너 */}
      <section className="py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Link
              href="/products"
              className="relative block h-40 md:h-52 rounded-lg overflow-hidden bg-gradient-to-r from-primary/10 to-accent/10 group"
            >
              <div className="absolute inset-0 flex flex-col justify-center px-8">
                <p className="text-xs tracking-[0.2em] text-muted-foreground mb-2">EVENT</p>
                <h3 className="text-lg md:text-xl font-bold mb-1">신규 가입 혜택</h3>
                <p className="text-sm text-muted-foreground">회원가입 시 3,000원 쿠폰 즉시 발급</p>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>
            <Link
              href="/products"
              className="relative block h-40 md:h-52 rounded-lg overflow-hidden bg-gradient-to-r from-secondary/50 to-warm group"
            >
              <div className="absolute inset-0 flex flex-col justify-center px-8">
                <p className="text-xs tracking-[0.2em] text-muted-foreground mb-2">SHIPPING</p>
                <h3 className="text-lg md:text-xl font-bold mb-1">무료배송</h3>
                <p className="text-sm text-muted-foreground">5만원 이상 구매 시 무료배송</p>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors">
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
