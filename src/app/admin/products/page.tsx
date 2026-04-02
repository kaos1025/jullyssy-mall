"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import NaverImportButton from "@/components/layout/NaverImportButton"
import { useToast } from "@/hooks/use-toast"

const statusLabel: Record<string, string> = {
  ACTIVE: "판매중",
  SOLDOUT: "품절",
  HIDDEN: "숨김",
  DELETED: "삭제",
}

interface ProductRow {
  id: string
  name: string
  price: number
  sale_price: number | null
  status: string
  created_at: string
  stock_sum: number
}

const AdminProductsPage = () => {
  const { toast } = useToast()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (search) params.set("search", search)

    const res = await fetch(`/api/admin/products?${params}`)
    const data = await res.json()
    setProducts(data.error ? [] : data)
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <div className="flex gap-2">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명 검색"
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
        <Button type="submit" variant="outline" size="sm">
          검색
        </Button>
      </form>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">상품명</th>
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
                <td
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  로딩 중...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium max-w-[200px] truncate">
                    {product.name}
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
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/products/${product.id}`}>수정</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (!confirm(`"${product.name}" 상품을 삭제하시겠습니까?`)) return
                          const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" })
                          if (res.ok) {
                            toast({ title: "상품 삭제 완료" })
                            fetchProducts()
                          } else {
                            toast({ variant: "destructive", title: "삭제 실패" })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
