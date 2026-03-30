"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  currentCategory?: string
  currentSort?: string
}

const ProductListFilter = ({
  categories,
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

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {/* 카테고리 탭 */}
      <Tabs
        value={currentCategory || "all"}
        onValueChange={(value) =>
          updateParam("category", value === "all" ? "" : value)
        }
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all" className="text-xs md:text-sm">
            전체
          </TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger
              key={cat.id}
              value={cat.slug}
              className="text-xs md:text-sm"
            >
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 정렬 */}
      <Select
        value={currentSort || "newest"}
        onValueChange={(value) => updateParam("sort", value)}
      >
        <SelectTrigger className="w-[140px]">
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
  )
}

export default ProductListFilter
