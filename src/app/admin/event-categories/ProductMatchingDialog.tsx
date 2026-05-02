"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Search, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface SearchProductRow {
  id: string
  name: string
  price: number
  sale_price: number | null
  status: string
  thumbnail_url: string | null
  category_name: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventCategoryId: string
  existingProductIds: Set<string>
  onAdd: (added: number, skipped: number) => void
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "판매중",
  SOLDOUT: "품절",
  HIDDEN: "숨김",
}

const ProductMatchingDialog = ({
  open,
  onOpenChange,
  eventCategoryId,
  existingProductIds,
  onAdd,
}: Props) => {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<SearchProductRow[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // 다이얼로그 닫힘 시 상태 초기화
  useEffect(() => {
    if (!open) {
      setSearch("")
      setResults([])
      setSearched(false)
      setSelectedIds(new Set())
    }
  }, [open])

  const runSearch = useCallback(async () => {
    setLoading(true)
    setSearched(true)
    const params = new URLSearchParams()
    if (search.trim()) params.set("search", search.trim())
    params.set("page", "1")
    params.set("per_page", "20")

    const res = await fetch(`/api/admin/products?${params}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "상품 검색 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      setResults([])
      setLoading(false)
      return
    }
    const data = await res.json()
    setResults(data.products ?? [])
    setLoading(false)
  }, [search, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    runSearch()
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAdd = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      toast({ variant: "destructive", title: "선택된 상품이 없습니다" })
      return
    }
    setSubmitting(true)
    const res = await fetch(
      `/api/admin/event-categories/${eventCategoryId}/products`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: ids }),
      }
    )
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "매칭 추가 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      return
    }
    const data: { added: number; skipped: number } = await res.json()
    onAdd(data.added, data.skipped)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>상품 추가</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="상품명 검색"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            검색
          </Button>
        </form>

        <div className="max-h-[400px] overflow-y-auto border rounded-md">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              검색 중...
            </div>
          ) : !searched ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              상품명을 입력하고 검색하세요. (최근 상품 20건 노출)
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              검색 결과가 없습니다.
            </div>
          ) : (
            <ul className="divide-y">
              {results.map((p) => {
                const isExisting = existingProductIds.has(p.id)
                const isSelected = selectedIds.has(p.id)
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-3 p-3 ${
                      isExisting ? "bg-muted/30" : "hover:bg-muted/20"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isExisting}
                      onCheckedChange={() =>
                        !isExisting && toggleSelect(p.id)
                      }
                    />
                    {p.thumbnail_url ? (
                      <Image
                        src={p.thumbnail_url}
                        alt={p.name}
                        width={50}
                        height={50}
                        className="rounded object-cover w-[50px] h-[50px] shrink-0"
                      />
                    ) : (
                      <div className="w-[50px] h-[50px] rounded bg-muted flex items-center justify-center shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.category_name ?? "카테고리 미설정"}
                      </p>
                    </div>
                    <div className="text-right text-xs shrink-0">
                      <p className="font-medium">
                        {(p.sale_price ?? p.price).toLocaleString()}원
                      </p>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </div>
                    {isExisting && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        매칭됨
                      </Badge>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size}개 선택됨
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              onClick={handleAdd}
              disabled={submitting || selectedIds.size === 0}
            >
              {submitting ? "추가 중..." : "추가"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ProductMatchingDialog
