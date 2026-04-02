"use client"

import { useState, useCallback } from "react"
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
  channelProductNo: string | null
  name: string
  price: number
  salePrice: number | null
  status: string
  imageUrl: string | null
  alreadyImported: boolean
}

const DISPLAY_STEP = 20

const NaverImportButton = ({ onClose }: { onClose?: () => void }) => {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [products, setProducts] = useState<NaverProductItem[]>([])
  const [selectedNos, setSelectedNos] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [displayCount, setDisplayCount] = useState(DISPLAY_STEP)
  const [searched, setSearched] = useState(false)

  const fetchProducts = useCallback(async (keyword: string) => {
    setLoading(true)
    setSearched(true)
    setDisplayCount(DISPLAY_STEP)
    try {
      const params = new URLSearchParams({ size: "500" })
      if (keyword) params.set("keyword", keyword)

      const res = await fetch(`/api/naver/products?${params}`)
      const data = await res.json()

      if (data.error) {
        toast({ variant: "destructive", title: "조회 실패", description: data.error })
        setProducts([])
        return
      }

      setProducts(data.contents || [])
    } catch {
      toast({ variant: "destructive", title: "조회 실패" })
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setProducts([])
      setSelectedNos(new Set())
      setSearch("")
      setSearched(false)
      setDisplayCount(DISPLAY_STEP)
    } else {
      onClose?.()
    }
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    fetchProducts(search)
  }

  const handleFetchAll = () => {
    setSearch("")
    fetchProducts("")
  }

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + DISPLAY_STEP)
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

  const displayedProducts = products.slice(0, displayCount)
  const hasMore = displayCount < products.length

  const selectableProducts = products.filter((p) => !p.alreadyImported)
  const allSelectableSelected =
    selectableProducts.length > 0 &&
    selectableProducts.every((p) => selectedNos.has(p.productNo))

  const toggleSelectAll = () => {
    if (selectableProducts.length === 0) return

    if (allSelectableSelected) {
      setSelectedNos((prev) => {
        const next = new Set(prev)
        selectableProducts.forEach((p) => next.delete(p.productNo))
        return next
      })
    } else {
      setSelectedNos((prev) => {
        const next = new Set(prev)
        selectableProducts.forEach((p) => next.add(p.productNo))
        return next
      })
    }
  }

  const handleImport = async () => {
    if (selectedNos.size === 0) return
    setImporting(true)

    try {
      // 선택된 상품의 productNo + channelProductNo 매핑
      const items = products
        .filter((p) => selectedNos.has(p.productNo))
        .map((p) => ({ productNo: p.productNo, channelProductNo: p.channelProductNo }))

      const res = await fetch("/api/naver/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()

      if (res.ok) {
        toast({
          title: "임포트 완료",
          description: `총 ${data.total}건 중 성공 ${data.success}건, 실패 ${data.fail}건`,
        })
        setSelectedNos(new Set())
        // 현재 검색 결과 새로고침
        fetchProducts(search)
      } else {
        toast({ variant: "destructive", title: "임포트 실패", description: data.error })
      }
    } catch {
      toast({ variant: "destructive", title: "임포트 실패" })
    } finally {
      setImporting(false)
    }
  }

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
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="상품명 또는 상품번호"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading} size="sm">
            검색
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFetchAll}
            disabled={loading}
          >
            전체 조회
          </Button>
        </form>

        {/* 상품 목록 */}
        <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
          {!searched ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>상품명 또는 상품번호를 검색하세요</p>
              <p className="text-xs mt-1">전체 목록을 보려면 &quot;전체 조회&quot; 버튼을 누르세요</p>
            </div>
          ) : (
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
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      불러오는 중...
                    </td>
                  </tr>
                ) : displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((product) => (
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
          )}

          {/* 더 보기 */}
          {searched && hasMore && (
            <div className="p-3 text-center border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
              >
                더 보기 ({displayedProducts.length}/{products.length})
              </Button>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {searched ? `${products.length}개 결과` : ""}{" "}
            {selectedNos.size > 0 && `${selectedNos.size}개 선택`}
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
