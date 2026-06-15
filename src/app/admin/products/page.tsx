"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus, Search, Trash2, ImageIcon, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import NaverImportButton from "@/components/layout/NaverImportButton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { FIT_TYPE_VALUES, FIT_TYPE_LABELS } from "@/lib/product/fit-type"
import { isApparelCategory, type CategoryNode } from "@/lib/product/category"

interface CategoryItem {
  id: string
  name: string
  parent_id: string | null
  slug: string | null
}

interface ProductRow {
  id: string
  name: string
  price: number
  sale_price: number | null
  status: string
  created_at: string
  stock_sum: number
  thumbnail_url: string | null
  category_id: string | null
  category_name: string | null
  fit_type: string | null
}

interface RefitChange {
  id: string
  name: string
  to: string
  via: string
}

interface RefitResult {
  active_regular: number
  candidates: number
  changes: RefitChange[]
  skipped: { non_apparel: number; no_category: number; no_extract: number }
  applied?: number
  enqueued?: number
  preview?: boolean
}

type EditingCell = { id: string; field: "name" | "price" | "sale_price" } | null

const InlineInput = ({
  value,
  onSave,
  onCancel,
  type = "text",
}: {
  value: string
  onSave: (v: string) => void
  onCancel: () => void
  type?: "text" | "number"
}) => {
  const ref = useRef<HTMLInputElement>(null)
  const [v, setV] = useState(value)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const handleSave = () => {
    if (v !== value) onSave(v)
    else onCancel()
  }

  return (
    <Input
      ref={ref}
      type={type}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave()
        if (e.key === "Escape") onCancel()
      }}
      className="h-8 text-sm"
    />
  )
}

const CategoryInlineEditor = ({
  currentCategoryId,
  parentCategories,
  getChildrenOf,
  getParentForCategory,
  onSave,
  onCancel,
}: {
  currentCategoryId: string | null
  parentCategories: CategoryItem[]
  getChildrenOf: (parentId: string) => CategoryItem[]
  getParentForCategory: (categoryId: string | null) => string
  onSave: (categoryId: string | null) => void
  onCancel: () => void
}) => {
  const initialParent = getParentForCategory(currentCategoryId)
  const [selectedParent, setSelectedParent] = useState(initialParent)
  const children = selectedParent !== "none" ? getChildrenOf(selectedParent) : []
  const hasChildren = children.length > 0

  // 현재값이 하위 카테고리인지 확인
  const isCurrentChild = currentCategoryId
    ? parentCategories.every((p) => p.id !== currentCategoryId)
    : false
  const [selectedChild, setSelectedChild] = useState(
    isCurrentChild && currentCategoryId ? currentCategoryId : "none"
  )

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedParent}
        onValueChange={(v) => {
          setSelectedParent(v)
          setSelectedChild("none")
          if (v === "none") {
            onSave(null)
          } else {
            const kids = getChildrenOf(v)
            if (kids.length === 0) {
              onSave(v)
            }
          }
        }}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs">
          <SelectValue placeholder="상위">
            {selectedParent !== "none"
              ? parentCategories.find((c) => c.id === selectedParent)?.name
              : "상위"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">없음</SelectItem>
          {parentCategories.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={selectedChild}
        onValueChange={(v) => {
          setSelectedChild(v)
          if (v === "none") return
          onSave(v)
        }}
        disabled={!hasChildren || selectedParent === "none"}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs">
          <SelectValue placeholder="하위">
            {selectedChild !== "none"
              ? children.find((c) => c.id === selectedChild)?.name
              : "하위"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">선택</SelectItem>
          {children.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onCancel}>
        취소
      </Button>
    </div>
  )
}

const AdminProductsPage = () => {
  const { toast } = useToast()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  // 입력값과 쿼리 트리거 분리 — search만 fetchProducts 의존성(제출 시 갱신)
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [refitPreview, setRefitPreview] = useState<RefitResult | null>(null)
  const [refitLoading, setRefitLoading] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

  // fit tri-state(GRID-NONAPPAREL-FIT-UI-1) — isApparelCategory SSOT(PR #55) 그대로 재사용.
  // category 존재 + 비의류만 fit 비활성. 의류·무카테고리는 편집 유지(form tri-state 일치).
  const catById = useMemo(() => {
    const m = new Map<string, CategoryNode>()
    for (const c of categories) m.set(c.id, { slug: c.slug, parent_id: c.parent_id })
    return m
  }, [categories])
  const isRowNonApparel = (categoryId: string | null): boolean =>
    !!categoryId && !isApparelCategory(categoryId, catById)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (search) params.set("search", search)
    params.set("page", String(page))
    params.set("per_page", String(perPage))

    const res = await fetch(`/api/admin/products?${params}`)
    const data = await res.json()
    if (data.error) {
      setProducts([])
      setTotalCount(0)
    } else {
      setProducts(data.products || [])
      setCategories(data.categories || [])
      setTotalCount(data.totalCount ?? 0)
    }
    setSelectedIds(new Set())
    setEditingCategoryId(null)
    setLoading(false)
  }, [statusFilter, search, page, perPage])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  // 인라인 편집 PATCH
  const patchProduct = async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      toast({ variant: "destructive", title: "수정 실패" })
      return false
    }
    toast({ title: "수정 완료" })
    return true
  }

  const handleInlineSave = async (id: string, field: string, value: string) => {
    setEditingCell(null)
    const numFields = ["price", "sale_price"]
    const parsed = numFields.includes(field) ? parseInt(value) || 0 : value
    const updates = { [field]: field === "sale_price" && parsed === 0 ? null : parsed }

    const ok = await patchProduct(id, updates)
    if (ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      )
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    const ok = await patchProduct(id, { status: newStatus })
    if (ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      )
    }
  }

  // 카테고리 편집
  const parentCategories = categories.filter((c) => !c.parent_id)
  const getChildrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId)

  const getParentForCategory = (categoryId: string | null): string => {
    if (!categoryId) return "none"
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return "none"
    return cat.parent_id || cat.id
  }

  const getCategoryName = (categoryId: string | null): string | null => {
    if (!categoryId) return null
    const cat = categories.find((c) => c.id === categoryId)
    if (!cat) return null
    if (cat.parent_id) {
      const parent = categories.find((c) => c.id === cat.parent_id)
      return parent ? `${parent.name} > ${cat.name}` : cat.name
    }
    return cat.name
  }

  const handleCategoryChange = async (productId: string, categoryId: string | null) => {
    const ok = await patchProduct(productId, { category_id: categoryId })
    if (ok) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, category_id: categoryId, category_name: getCategoryName(categoryId) }
            : p
        )
      )
      setEditingCategoryId(null)
    }
  }

  // 체크박스
  const allSelected = products.length > 0 && selectedIds.size === products.length
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 일괄 작업
  const bulkChangeStatus = async (newStatus: string) => {
    const ids = Array.from(selectedIds)
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    )
    const successCount = results.filter((r) => r.ok).length
    toast({ title: `${successCount}건 상태 변경 완료` })
    setSelectedIds(new Set())
    fetchProducts()
  }

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`${ids.length}개 상품을 삭제하시겠습니까?`)) return

    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/products/${id}`, { method: "DELETE" })
      )
    )
    const successCount = results.filter((r) => r.ok).length
    toast({ title: `${successCount}건 삭제 완료` })
    setSelectedIds(new Set())
    fetchProducts()
  }

  // fit_type 인라인/일괄
  const handleFitTypeChange = async (id: string, newFit: string) => {
    const ok = await patchProduct(id, { fit_type: newFit })
    if (ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, fit_type: newFit } : p))
      )
    }
  }

  const bulkChangeFitType = async (newFit: string) => {
    const allIds = Array.from(selectedIds)
    // 비의류만 skip (서버가 NULL 강제 → "설정했는데 NULL" 혼란 방지). 의류·무카테고리는 적용.
    const productById = new Map(products.map((p) => [p.id, p]))
    const targetIds = allIds.filter(
      (id) => !isRowNonApparel(productById.get(id)?.category_id ?? null)
    )
    const skipped = allIds.length - targetIds.length
    if (targetIds.length === 0) {
      toast({ title: `적용 대상 없음 (비의류 ${skipped}건 제외)` })
      return
    }
    const results = await Promise.all(
      targetIds.map((id) =>
        fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fit_type: newFit }),
        })
      )
    )
    const successCount = results.filter((r) => r.ok).length
    toast({
      title:
        skipped > 0
          ? `${successCount}건 핏 적용 (비의류 ${skipped}건 제외)`
          : `${successCount}건 핏 적용 완료`,
    })
    setSelectedIds(new Set())
    fetchProducts()
  }

  // 선택 항목 SEO 재생성 큐 적재 (replace — 핏 반영). 중복/터미널은 서버에서 409로 제외.
  const bulkEnqueueRegen = async () => {
    const ids = Array.from(selectedIds)
    if (!confirm(`${ids.length}개 상품 SEO를 재생성 큐에 적재할까요?`)) return
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/products/${id}/regenerate-seo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description_mode: "replace" }),
        })
      )
    )
    const successCount = results.filter((r) => r.ok).length
    toast({ title: `${successCount}건 재생성 큐 적재 (중복/터미널 제외)` })
    setSelectedIds(new Set())
  }

  // 핏 자동 재매핑 (의류 한정) — 미리보기 후 적용 (D5)
  const openRefitPreview = async () => {
    setRefitLoading(true)
    try {
      const res = await fetch(`/api/admin/products/refit-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "destructive", title: data.error || "미리보기 실패" })
        return
      }
      setRefitPreview(data as RefitResult)
    } finally {
      setRefitLoading(false)
    }
  }

  const applyRefit = async () => {
    setRefitLoading(true)
    try {
      const res = await fetch(`/api/admin/products/refit-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, enqueue: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "destructive", title: data.error || "적용 실패" })
        return
      }
      toast({
        title: `${data.applied}건 핏 자동 적용, ${data.enqueued}건 재생성 큐 적재`,
      })
      setRefitPreview(null)
      fetchProducts()
    } finally {
      setRefitLoading(false)
    }
  }

  const colSpan = 11

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openRefitPreview} disabled={refitLoading}>
            핏 자동 재매핑
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/products/material-backfill">소재 채움</Link>
          </Button>
          <NaverImportButton onClose={fetchProducts} />
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="h-4 w-4 mr-2" />
              상품 등록
            </Link>
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="상품명 검색"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 상태</SelectItem>
            <SelectItem value="ACTIVE">판매중</SelectItem>
            <SelectItem value="SOLDOUT">품절</SelectItem>
            <SelectItem value="HIDDEN">숨김</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" size="sm">
          검색
        </Button>
      </form>

      {/* 일괄 액션바 */}
      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium">{selectedIds.size}개 선택</span>
          <Select onValueChange={bulkChangeStatus}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="일괄 상태 변경" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">판매중</SelectItem>
              <SelectItem value="SOLDOUT">품절</SelectItem>
              <SelectItem value="HIDDEN">숨김</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={bulkChangeFitType}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="일괄 핏 적용" />
            </SelectTrigger>
            <SelectContent>
              {FIT_TYPE_VALUES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {FIT_TYPE_LABELS[ft]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={bulkEnqueueRegen}>
            SEO 재생성 큐 적재
          </Button>
          <Button variant="destructive" size="sm" onClick={bulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            일괄 삭제
          </Button>
        </div>
      )}

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="p-3 w-[50px]"></th>
              <th className="p-3 text-left">상품명</th>
              <th className="p-3 text-left hidden lg:table-cell">카테고리</th>
              <th className="p-3 text-right">정가</th>
              <th className="p-3 text-right">할인가</th>
              <th className="p-3 text-center">판매상태</th>
              <th className="p-3 text-center">핏</th>
              <th className="p-3 text-right hidden md:table-cell">재고</th>
              <th className="p-3 text-left hidden md:table-cell">등록일</th>
              <th className="p-3 text-center w-16">수정</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-10 text-muted-foreground">
                  상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-t hover:bg-muted/30">
                  {/* 체크박스 */}
                  <td className="p-3">
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleOne(product.id)}
                    />
                  </td>

                  {/* 썸네일 */}
                  <td className="p-3">
                    {product.thumbnail_url ? (
                      <Image
                        src={product.thumbnail_url}
                        alt={product.name}
                        width={50}
                        height={50}
                        className="rounded object-cover w-[50px] h-[50px]"
                      />
                    ) : (
                      <div className="w-[50px] h-[50px] rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </td>

                  {/* 상품명 (인라인 편집) */}
                  <td className="p-3 max-w-[250px]">
                    {editingCell?.id === product.id && editingCell.field === "name" ? (
                      <InlineInput
                        value={product.name}
                        onSave={(v) => handleInlineSave(product.id, "name", v)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span
                          className="cursor-pointer hover:underline truncate font-medium"
                          onClick={() => setEditingCell({ id: product.id, field: "name" })}
                        >
                          {product.name}
                        </span>
                        <Link
                          href={`/products/${product.id}`}
                          target="_blank"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </td>

                  {/* 카테고리 (인라인 편집) */}
                  <td className="p-3 hidden lg:table-cell">
                    {editingCategoryId === product.id ? (
                      <CategoryInlineEditor
                        currentCategoryId={product.category_id}
                        parentCategories={parentCategories}
                        getChildrenOf={getChildrenOf}
                        getParentForCategory={getParentForCategory}
                        onSave={(catId) => handleCategoryChange(product.id, catId)}
                        onCancel={() => setEditingCategoryId(null)}
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline text-sm"
                        onClick={() => setEditingCategoryId(product.id)}
                      >
                        {product.category_name || <span className="text-muted-foreground">미설정</span>}
                      </span>
                    )}
                  </td>

                  {/* 정가 (인라인 편집) */}
                  <td className="p-3 text-right">
                    {editingCell?.id === product.id && editingCell.field === "price" ? (
                      <InlineInput
                        value={String(product.price)}
                        type="number"
                        onSave={(v) => handleInlineSave(product.id, "price", v)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => setEditingCell({ id: product.id, field: "price" })}
                      >
                        {product.price.toLocaleString()}원
                      </span>
                    )}
                  </td>

                  {/* 할인가 (인라인 편집) */}
                  <td className="p-3 text-right">
                    {editingCell?.id === product.id && editingCell.field === "sale_price" ? (
                      <InlineInput
                        value={String(product.sale_price || "")}
                        type="number"
                        onSave={(v) => handleInlineSave(product.id, "sale_price", v)}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => setEditingCell({ id: product.id, field: "sale_price" })}
                      >
                        {product.sale_price ? `${product.sale_price.toLocaleString()}원` : "-"}
                      </span>
                    )}
                  </td>

                  {/* 판매상태 (드롭다운) */}
                  <td className="p-3 text-center">
                    <Select
                      value={product.status}
                      onValueChange={(v) => handleStatusChange(product.id, v)}
                    >
                      <SelectTrigger className="w-[100px] h-8 mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">판매중</SelectItem>
                        <SelectItem value="SOLDOUT">품절</SelectItem>
                        <SelectItem value="HIDDEN">숨김</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>

                  {/* 핏 (드롭다운) — 비의류는 비활성("—"), 의류·무카테고리는 편집 (tri-state, form 일치) */}
                  <td className="p-3 text-center">
                    {isRowNonApparel(product.category_id) ? (
                      <span
                        className="inline-flex items-center justify-center w-[110px] h-8 mx-auto text-sm text-muted-foreground"
                        title="비의류 — 핏 미지정"
                      >
                        —
                      </span>
                    ) : (
                      <Select
                        value={product.fit_type ?? undefined}
                        onValueChange={(v) => handleFitTypeChange(product.id, v)}
                      >
                        <SelectTrigger className="w-[110px] h-8 mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIT_TYPE_VALUES.map((ft) => (
                            <SelectItem key={ft} value={ft}>
                              {FIT_TYPE_LABELS[ft]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>

                  {/* 재고 */}
                  <td className="p-3 text-right hidden md:table-cell">
                    {product.stock_sum}
                  </td>

                  {/* 등록일 */}
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {new Date(product.created_at).toLocaleDateString("ko-KR")}
                  </td>

                  {/* 수정 */}
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/products/${product.id}`}>수정</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {!loading && totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">전체 {totalCount.toLocaleString()}개</span>
            <div className="flex items-center gap-1.5">
              <span>페이지당</span>
              <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1) }}>
                <SelectTrigger className="w-[75px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>개</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {(() => {
              const pages: number[] = []
              const maxVisible = 5
              let start = Math.max(1, page - Math.floor(maxVisible / 2))
              const end = Math.min(totalPages, start + maxVisible - 1)
              start = Math.max(1, end - maxVisible + 1)
              for (let i = start; i <= end; i++) pages.push(i)
              return pages.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))
            })()}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 핏 자동 재매핑 미리보기/적용 모달 (D5, 의류 카테고리 한정) */}
      <Dialog
        open={!!refitPreview}
        onOpenChange={(o) => {
          if (!o) setRefitPreview(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>핏 자동 재매핑 (의류 한정)</DialogTitle>
            <DialogDescription>
              ACTIVE 의류 상품 중 핏이 &apos;기본핏&apos;인 항목의 상세설명/태그에서
              핏을 추출해 적용합니다. 가방·신발·악세서리·미분류는 제외됩니다.
            </DialogDescription>
          </DialogHeader>
          {refitPreview && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  기본핏 ACTIVE:{" "}
                  <b className="text-foreground">{refitPreview.active_regular}</b>
                </span>
                <span>
                  변경 예정:{" "}
                  <b className="text-foreground">{refitPreview.candidates}</b>
                </span>
                <span>비의류 제외: {refitPreview.skipped.non_apparel}</span>
                <span>미분류 제외: {refitPreview.skipped.no_category}</span>
                <span>추출 불가: {refitPreview.skipped.no_extract}</span>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded divide-y">
                {refitPreview.changes.length === 0 ? (
                  <div className="p-3 text-muted-foreground">
                    변경 대상이 없습니다.
                  </div>
                ) : (
                  refitPreview.changes.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 p-2"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 text-xs">
                        →{" "}
                        <b>
                          {FIT_TYPE_LABELS[c.to as keyof typeof FIT_TYPE_LABELS] ??
                            c.to}
                        </b>
                        <span className="text-muted-foreground ml-1">({c.via})</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setRefitPreview(null)}
              disabled={refitLoading}
            >
              취소
            </Button>
            <Button
              onClick={applyRefit}
              disabled={
                refitLoading || !refitPreview || refitPreview.candidates === 0
              }
            >
              {refitLoading
                ? "적용 중..."
                : `${refitPreview?.candidates ?? 0}건 적용 + 재생성`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminProductsPage
