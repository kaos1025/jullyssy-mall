"use client"

import { useState, useMemo } from "react"
import { Upload, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface NaverProductItem {
  productNo: string
  name: string
  price: number
  salePrice: number | null
  status: string
  imageUrl: string | null
  alreadyImported: boolean
}

const PAGE_SIZE = 20

const NaverImportButton = () => {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<NaverProductItem[]>([])
  const [selectedNos, setSelectedNos] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchProducts = async (pageNum: number, append = false) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/naver/products?page=${pageNum}&size=${PAGE_SIZE}`)
      const data = await res.json()

      if (data.error) {
        toast({ variant: "destructive", title: "조회 실패", description: data.error })
        return
      }

      const newProducts: NaverProductItem[] = data.contents || []
      setProducts((prev) => append ? [...prev, ...newProducts] : newProducts)
      setTotal(data.total || 0)
      setPage(pageNum)
      setHasMore(pageNum * PAGE_SIZE < (data.total || 0))
    } catch {
      toast({ variant: "destructive", title: "조회 실패" })
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setProducts([])
      setSelectedNos(new Set())
      setSearch("")
      setPage(1)
      fetchProducts(1)
    }
  }

  const handleLoadMore = () => {
    fetchProducts(page + 1, true)
  }

  const toggleSelect = (productNo: string) => {
    setSelectedNos((prev) => {
      const next = new Set(prev)
      if (next.has(productNo)) {
        next.delete(productNo)
      } else {
        next.add(productNo)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    const selectableItems = filteredProducts.filter((p) => !p.alreadyImported)
    if (selectableItems.length === 0) return

    const allSelected = selectableItems.every((p) => selectedNos.has(p.productNo))
    if (allSelected) {
      setSelectedNos((prev) => {
        const next = new Set(prev)
        selectableItems.forEach((p) => next.delete(p.productNo))
        return next
      })
    } else {
      setSelectedNos((prev) => {
        const next = new Set(prev)
        selectableItems.forEach((p) => next.add(p.productNo))
        return next
      })
    }
  }

  const handleImport = async () => {
    if (selectedNos.size === 0) return
    setImporting(true)

    try {
      const res = await fetch("/api/naver/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productNos: Array.from(selectedNos) }),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: "임포트 완료",
          description: `총 ${data.total}건 중 성공 ${data.success}건, 실패 ${data.fail}건`,
        })
        // 임포트 후 목록 새로고침
        setSelectedNos(new Set())
        fetchProducts(1)
      } else {
        toast({ variant: "destructive", title: "임포트 실패", description: data.error })
      }
    } catch {
      toast({ variant: "destructive", title: "임포트 실패" })
    } finally {
      setImporting(false)
    }
  }

  const filteredProducts = useMemo(() => {
    if (!search) return products
    const keyword = search.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(keyword))
  }, [products, search])

  const selectableFiltered = filteredProducts.filter((p) => !p.alreadyImported)
  const allSelectableSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((p) => selectedNos.has(p.productNo))

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          스마트스토어 임포트
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>스마트스토어 상품 임포트</DialogTitle>
        </DialogHeader>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="상품명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 상품 목록 */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded"
                  />
                </th>
                <th className="p-2 w-12"></th>
                <th className="p-2 text-left">상품명</th>
                <th className="p-2 text-right">가격</th>
                <th className="p-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    불러오는 중...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    상품이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.productNo}
                    className={`border-t hover:bg-muted/30 ${product.alreadyImported ? "opacity-50" : ""}`}
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedNos.has(product.productNo)}
                        onChange={() => toggleSelect(product.productNo)}
                        disabled={product.alreadyImported}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="p-2">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded" />
                      )}
                    </td>
                    <td className="p-2 max-w-[200px] truncate">
                      {product.name}
                      {product.alreadyImported && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          임포트됨
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {product.salePrice ? (
                        <>
                          <span className="line-through text-muted-foreground mr-1">
                            {product.price.toLocaleString()}
                          </span>
                          {product.salePrice.toLocaleString()}
                        </>
                      ) : (
                        product.price.toLocaleString()
                      )}
                      원
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant={product.status === "SALE" ? "default" : "secondary"}>
                        {product.status === "SALE" ? "판매중" : product.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 더 보기 */}
          {hasMore && (
            <div className="p-3 text-center border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? "불러오는 중..." : `더 보기 (${products.length}/${total})`}
              </Button>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            총 {total}개 중 {selectedNos.size}개 선택
          </p>
          <Button
            onClick={handleImport}
            disabled={selectedNos.size === 0 || importing}
          >
            {importing
              ? "임포트 중..."
              : `선택한 ${selectedNos.size}개 임포트`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default NaverImportButton
