"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCart } from "@/hooks/use-cart"
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/constants"

const CartPage = () => {
  const router = useRouter()
  const { items, removeItem, updateQuantity } = useCart()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setSelectedIds(items.map((i) => i.product_option_id))
  }, [items])

  if (!mounted) {
    return (
      <div className="container py-8">
        <h1 className="text-xl font-bold mb-6">장바구니</h1>
        <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i.product_option_id))
    }
  }

  const selectedItems = items.filter((i) =>
    selectedIds.includes(i.product_option_id)
  )
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + (item.price + item.extra_price) * item.quantity,
    0
  )
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : subtotal > 0 ? SHIPPING_FEE : 0
  const total = subtotal + shippingFee

  if (items.length === 0) {
    return (
      <div className="container py-8">
        <h1 className="text-xl font-bold mb-6">장바구니</h1>
        <div className="text-center py-20 space-y-4">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">장바구니가 비어있습니다.</p>
          <Button asChild>
            <Link href="/products">쇼핑하러 가기</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="text-xl font-bold mb-6">
        장바구니 <span className="text-muted-foreground font-normal text-base">({items.length})</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 상품 목록 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 전체 선택 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.length === items.length}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm">
              전체선택 ({selectedIds.length}/{items.length})
            </span>
          </div>

          <Separator />

          {items.map((item) => (
            <div
              key={item.product_option_id}
              className="flex gap-4 py-4 border-b last:border-0"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item.product_option_id)}
                onChange={() => toggleSelect(item.product_option_id)}
                className="h-4 w-4 rounded mt-1"
              />

              {/* 이미지 */}
              <div className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                {item.product_image ? (
                  <Image
                    src={item.product_image}
                    alt={item.product_name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No img
                  </div>
                )}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.product_id}`}
                  className="text-sm font-medium hover:text-primary line-clamp-1"
                >
                  {item.product_name}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.color} / {item.size}
                </p>

                <div className="flex items-center justify-between mt-3">
                  {/* 수량 */}
                  <div className="flex items-center border rounded-md">
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.product_option_id,
                          item.quantity - 1
                        )
                      }
                      className="p-1.5 hover:bg-muted"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.product_option_id,
                          item.quantity + 1
                        )
                      }
                      className="p-1.5 hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* 가격 + 삭제 */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">
                      {(
                        (item.price + item.extra_price) *
                        item.quantity
                      ).toLocaleString()}
                      원
                    </span>
                    <button
                      onClick={() => removeItem(item.product_option_id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 주문 요약 */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 border rounded-lg p-6 space-y-4">
            <h2 className="font-bold">주문 요약</h2>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">총 상품금액</span>
                <span>{subtotal.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">배송비</span>
                <span>
                  {shippingFee === 0 && subtotal > 0
                    ? "무료"
                    : `${shippingFee.toLocaleString()}원`}
                </span>
              </div>
              {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
                <p className="text-xs text-primary">
                  {(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString()}원 더 담으면
                  무료배송!
                </p>
              )}
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>예상 결제금액</span>
              <span>{total.toLocaleString()}원</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={selectedItems.length === 0}
              onClick={() => router.push("/checkout")}
            >
              주문하기 ({selectedItems.length}개)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CartPage
