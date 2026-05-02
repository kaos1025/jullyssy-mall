import { notFound } from "next/navigation"
import Link from "next/link"
import dayjs from "dayjs"
import { PackageOpen } from "lucide-react"
import {
  getEventCategoryWithProducts,
  toProductCardProps,
} from "@/lib/events"
import type { EventProductSort } from "@/lib/events-utils"
import ProductCard from "@/components/product/ProductCard"
import EventSortSelect from "./EventSortSelect"
import type { Metadata } from "next"

interface Props {
  params: { id: string }
  searchParams: { sort?: string }
}

const normalizeSort = (raw?: string): EventProductSort => {
  if (raw === "newest" || raw === "price_asc" || raw === "admin") return raw
  return "admin"
}

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  const result = await getEventCategoryWithProducts(params.id)
  if (!result) return { title: "이벤트 - 쥴리씨" }
  const { category, products } = result
  const titlePrefix = category.emoji ? `${category.emoji} ` : ""
  return {
    title: `${titlePrefix}${category.name} - 쥴리씨`,
    description: `${category.name} 이벤트 상품 ${products.length}건을 만나보세요.`,
    alternates: { canonical: `/events/${category.id}` },
  }
}

const EventPage = async ({ params, searchParams }: Props) => {
  const sort = normalizeSort(searchParams.sort)
  const result = await getEventCategoryWithProducts(params.id, sort)
  if (!result) notFound()

  const { category, products } = result
  const endsLabel = category.ends_at
    ? `${dayjs(category.ends_at).format("M월 D일")}까지`
    : null

  return (
    <div className="container py-6">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-1.5 h-7 rounded-sm shrink-0"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
          <h1 className="text-xl md:text-2xl font-bold flex items-baseline gap-2">
            {category.emoji && <span>{category.emoji}</span>}
            <span>{category.name}</span>
          </h1>
        </div>
        {endsLabel && (
          <time className="text-xs text-muted-foreground mt-2 block ml-[18px]">
            ~ {endsLabel}
          </time>
        )}
      </header>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          전체 {products.length.toLocaleString()}개
        </p>
        <EventSortSelect categoryId={category.id} currentSort={sort} />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <PackageOpen className="h-12 w-12 mb-4" strokeWidth={1.5} />
          <p className="text-sm">준비 중인 이벤트입니다</p>
          <p className="text-xs mt-1">곧 멋진 상품을 만나보세요!</p>
          <Link
            href="/products"
            className="mt-6 text-sm text-primary underline"
          >
            전체 상품 보기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {products.map((ep) => (
            <ProductCard key={ep.id} {...toProductCardProps(ep)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default EventPage
