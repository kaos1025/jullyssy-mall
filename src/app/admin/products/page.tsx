"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import type { Product } from "@/types"

const statusLabel: Record<string, string> = {
  ACTIVE: "판매중",
  SOLDOUT: "품절",
  HIDDEN: "숨김",
  DELETED: "삭제",
}

const AdminProductsPage = () => {
  const { toast } = useToast()
  const [products, setProducts] = useState<(Product & { stock_sum: number })[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from("products")
      .select("*, product_options(stock)")
      .neq("status", "DELETED")
      .order("created_at", { ascending: false })

    if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter)
    }

    if (search) {
      query = query.ilike("name", `%${search}%`)
    }

    const { data } = await query

    if (data) {
      const withStock = data.map((p) => ({
        ...p,
        stock_sum:
          p.product_options?.reduce(
            (sum: number, o: { stock: number }) => sum + o.stock,
            0
          ) || 0,
      }))
      setProducts(withStock as (Product & { stock_sum: number })[])
    }
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleBulkAction = async (action: "HIDDEN" | "DELETED") => {
    if (selectedIds.length === 0) return

    const supabase = createClient()
    const { error } = await supabase
      .from("products")
      .update({ status: action })
      .in("id", selectedIds)

    if (error) {
      toast({ variant: "destructive", title: "처리 실패" })
    } else {
      toast({ title: `${selectedIds.length}개 상품 ${action === "HIDDEN" ? "숨김" : "삭제"} 처리` })
      setSelectedIds([])
      fetchProducts()
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4 mr-2" />
            상품 등록
          </Link>
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="상품명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction("HIDDEN")}
            >
              일괄 숨김 ({selectedIds.length})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleBulkAction("DELETED")}
            >
              일괄 삭제 ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.length === products.length &&
                    products.length > 0
                  }
                  onChange={() =>
                    setSelectedIds(
                      selectedIds.length === products.length
                        ? []
                        : products.map((p) => p.id)
                    )
                  }
                  className="h-4 w-4 rounded"
                />
              </th>
              <th className="p-3 text-left">상품명</th>
              <th className="p-3 text-left hidden md:table-cell">카테고리</th>
              <th className="p-3 text-right">가격</th>
              <th className="p-3 text-right hidden md:table-cell">재고</th>
              <th className="p-3 text-center">상태</th>
              <th className="p-3 text-left hidden md:table-cell">등록일</th>
              <th className="p-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                  <td className="p-3 font-medium max-w-[200px] truncate">
                    {product.name}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    -
                  </td>
                  <td className="p-3 text-right">
                    {product.sale_price ? (
                      <span>
                        <span className="line-through text-muted-foreground mr-1">
                          {product.price.toLocaleString()}
                        </span>
                        {product.sale_price.toLocaleString()}
                      </span>
                    ) : (
                      product.price.toLocaleString()
                    )}
                    원
                  </td>
                  <td className="p-3 text-right hidden md:table-cell">
                    {product.stock_sum}
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={
                        product.status === "ACTIVE"
                          ? "default"
                          : product.status === "SOLDOUT"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {statusLabel[product.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {new Date(product.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/products/${product.id}`}>
                        수정
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminProductsPage
