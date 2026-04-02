"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SORT_OPTIONS } from "@/constants"
import type { Category } from "@/types"

interface ProductListFilterProps {
  categories: Category[]
  subCategories?: Category[]
  currentCategory?: string
  currentSort?: string
}

const ProductListFilter = ({
  categories,
  subCategories = [],
  currentCategory,
  currentSort,
}: ProductListFilterProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete("page")
    router.push(`/products?${params.toString()}`)
  }

  // 현재 선택된 카테고리가 1depth인지 2depth인지 판별
  const isParentActive = (slug: string) => {
    if (currentCategory === slug) return true
    return subCategories.some(
      (sub) => sub.slug === currentCategory && categories.find((c) => c.slug === slug)?.id === sub.parent_id
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* 카테고리 pill 버튼 */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide md:flex-wrap">
          <button
            onClick={() => updateParam("category", "")}
            className={`inline-block whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
              !currentCategory
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => updateParam("category", cat.slug)}
              className={`inline-block whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${
                isParentActive(cat.slug)
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* 정렬 */}
        <div className="flex items-center gap-2">
          {/* TODO: 가격 필터 (2차 구현) */}
          <Select
            value={currentSort || "newest"}
            onValueChange={(value) => updateParam("sort", value)}
          >
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 서브카테고리 2줄째 */}
      {subCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mt-2">
          {subCategories.map((sub) => (
            <button
              key={sub.id}
              onClick={() => updateParam("category", sub.slug)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm border transition-colors ${
                currentCategory === sub.slug
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProductListFilter
