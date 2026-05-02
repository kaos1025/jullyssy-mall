"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { Plus, Trash2, ImageIcon, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { AdminEventProductRow } from "@/lib/events-utils"
import ProductMatchingDialog from "./ProductMatchingDialog"

interface Props {
  eventCategoryId: string
  initialProducts: AdminEventProductRow[]
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "판매중",
  SOLDOUT: "품절",
  HIDDEN: "숨김",
}

const STATUS_VARIANT: Record<
  string,
  "default" | "outline" | "secondary" | "destructive"
> = {
  ACTIVE: "outline",
  SOLDOUT: "secondary",
  HIDDEN: "destructive",
}

const ProductMatchingSection = ({
  eventCategoryId,
  initialProducts,
}: Props) => {
  const { toast } = useToast()
  const [products, setProducts] = useState<AdminEventProductRow[]>(initialProducts)
  // 순서 변경 추적: product_id → 사용자 입력 display_order
  const [orderEdits, setOrderEdits] = useState<Map<string, number>>(new Map())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)

  const existingIds = useMemo(
    () => new Set(products.map((p) => p.product_id)),
    [products]
  )

  const refetch = async () => {
    const res = await fetch(
      `/api/admin/event-categories/${eventCategoryId}/products`
    )
    if (!res.ok) return
    const data: AdminEventProductRow[] = await res.json()
    setProducts(data)
    setOrderEdits(new Map())
  }

  const handleAdded = (added: number, skipped: number) => {
    if (added > 0 && skipped > 0) {
      toast({
        title: `${added}건 매칭됨`,
        description: `${skipped}건은 이미 매칭되어 있습니다`,
      })
    } else if (added > 0) {
      toast({ title: `${added}건 매칭되었습니다` })
    } else if (skipped > 0) {
      toast({
        title: "추가된 상품이 없습니다",
        description: `${skipped}건 모두 이미 매칭되어 있습니다`,
      })
    }
    refetch()
  }

  const handleRemove = async (productId: string) => {
    if (!confirm("이 상품을 매칭에서 제거하시겠습니까?")) return
    // Optimistic update
    const prev = products
    const prevEdits = orderEdits
    setProducts((p) => p.filter((x) => x.product_id !== productId))
    setOrderEdits((m) => {
      const next = new Map(m)
      next.delete(productId)
      return next
    })

    const res = await fetch(
      `/api/admin/event-categories/${eventCategoryId}/products/${productId}`,
      { method: "DELETE" }
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "제거 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      // 롤백
      setProducts(prev)
      setOrderEdits(prevEdits)
      return
    }
    toast({ title: "매칭에서 제거되었습니다" })
  }

  const handleOrderChange = (productId: string, raw: string) => {
    const parsed = parseInt(raw, 10)
    if (raw === "" || Number.isNaN(parsed)) {
      // 빈 값은 0으로 정규화하여 추적
      setOrderEdits((m) => {
        const next = new Map(m)
        next.set(productId, 0)
        return next
      })
      return
    }
    if (parsed < 0 || parsed > 99999) return
    setOrderEdits((m) => {
      const next = new Map(m)
      next.set(productId, parsed)
      return next
    })
  }

  const orderingPayload = useMemo(() => {
    const payload: { product_id: string; display_order: number }[] = []
    Array.from(orderEdits.entries()).forEach(([pid, value]) => {
      const original = products.find((p) => p.product_id === pid)
      if (original && original.display_order !== value) {
        payload.push({ product_id: pid, display_order: value })
      }
    })
    return payload
  }, [orderEdits, products])

  const handleSaveOrder = async () => {
    if (orderingPayload.length === 0) return
    setSavingOrder(true)
    const res = await fetch(
      `/api/admin/event-categories/${eventCategoryId}/products/order`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordering: orderingPayload }),
      }
    )
    setSavingOrder(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "순서 저장 실패",
        description: data.error ?? `HTTP ${res.status}`,
      })
      return
    }
    toast({ title: "순서가 저장되었습니다" })
    refetch()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">매칭 상품 ({products.length}건)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            이벤트 페이지에 노출할 상품을 매칭합니다. 비활성/품절 상품도 매칭 가능하지만 사용자에게는 노출되지 않습니다.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          상품 추가
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="border rounded-lg py-12 flex flex-col items-center text-muted-foreground">
          <PackagePlus className="h-10 w-10 mb-3" strokeWidth={1.5} />
          <p className="text-sm">매칭된 상품이 없습니다</p>
          <p className="text-xs mt-1">상품을 추가하여 이벤트 페이지에 노출하세요</p>
        </div>
      ) : (
        <ul className="divide-y border rounded-lg overflow-hidden">
          {products.map((p) => {
            const orderValue =
              orderEdits.get(p.product_id) ?? p.display_order
            const status = p.status ?? "ACTIVE"
            return (
              <li
                key={p.product_id}
                className="flex items-center gap-3 p-3 hover:bg-muted/20"
              >
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.sale_price != null ? (
                      <>
                        <span className="line-through mr-1.5">
                          {p.price.toLocaleString()}원
                        </span>
                        <span className="font-medium text-foreground">
                          {p.sale_price.toLocaleString()}원
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">
                        {p.price.toLocaleString()}원
                      </span>
                    )}
                  </p>
                </div>
                <Badge
                  variant={STATUS_VARIANT[status] ?? "outline"}
                  className="shrink-0 text-[10px]"
                >
                  {STATUS_LABEL[status] ?? status}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">순서</span>
                  <Input
                    type="number"
                    min={0}
                    max={99999}
                    value={orderValue}
                    onChange={(e) =>
                      handleOrderChange(p.product_id, e.target.value)
                    }
                    className="w-[80px] h-8 text-sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(p.product_id)}
                  aria-label="매칭 제거"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {orderingPayload.length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveOrder}
            disabled={savingOrder}
            variant="outline"
          >
            {savingOrder
              ? "저장 중..."
              : `순서 저장 (${orderingPayload.length}건 변경됨)`}
          </Button>
        </div>
      )}

      <ProductMatchingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventCategoryId={eventCategoryId}
        existingProductIds={existingIds}
        onAdd={handleAdded}
      />
    </section>
  )
}

export default ProductMatchingSection
