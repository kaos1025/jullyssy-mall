"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, X, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/hooks/use-cart"
import { cn } from "@/lib/utils"
import type { ProductOption } from "@/types"

interface SelectedItem {
  optionId: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  stock: number
}

interface ProductOptionsProps {
  productId: string
  productName: string
  productImage: string | null
  price: number
  salePrice: number | null
  options: ProductOption[]
}

const ProductOptions = ({
  productId,
  productName,
  productImage,
  price,
  salePrice,
  options,
}: ProductOptionsProps) => {
  const router = useRouter()
  const { toast } = useToast()
  const { addItem } = useCart()

  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const colors = Array.from(new Set(options.map((o) => o.color)))
  const availableSizes = selectedColor
    ? options.filter((o) => o.color === selectedColor)
    : []

  const basePrice = salePrice ?? price

  const totalPrice = selectedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )

  // 색상 + 사이즈 선택 완료 시 자동으로 selectedItems에 추가
  useEffect(() => {
    if (!selectedColor || !selectedSize) return

    const option = options.find(
      (o) => o.color === selectedColor && o.size === selectedSize
    )
    if (!option || option.stock === 0) return

    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.optionId === option.id)
      if (existing) {
        // 같은 옵션이면 수량 +1
        return prev.map((item) =>
          item.optionId === option.id
            ? { ...item, quantity: Math.min(item.quantity + 1, item.stock) }
            : item
        )
      }
      return [
        ...prev,
        {
          optionId: option.id,
          color: option.color,
          size: option.size,
          quantity: 1,
          unitPrice: basePrice + option.extra_price,
          stock: option.stock,
        },
      ]
    })

    // 하이라이트 애니메이션
    setHighlightId(option.id)
    setTimeout(() => setHighlightId(null), 1500)

    // 선택 초기화
    setSelectedColor(null)
    setSelectedSize(null)
  }, [selectedColor, selectedSize, options, basePrice])

  const updateQuantity = (optionId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.optionId === optionId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(item.stock, item.quantity + delta)),
            }
          : item
      )
    )
  }

  const removeItem = (optionId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.optionId !== optionId))
  }

  const handleAddToCart = () => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "옵션을 선택해주세요",
        description: "색상과 사이즈를 선택해주세요.",
      })
      return
    }

    selectedItems.forEach((item) => {
      const option = options.find((o) => o.id === item.optionId)
      if (!option) return
      addItem({
        product_id: productId,
        product_option_id: item.optionId,
        product_name: productName,
        product_image: productImage,
        color: item.color,
        size: item.size,
        price: basePrice,
        extra_price: option.extra_price,
        quantity: item.quantity,
        stock: item.stock,
      })
    })

    toast({
      title: "장바구니에 추가했습니다",
      description: `${productName} (${selectedItems.length}개 옵션)`,
    })

    setSelectedItems([])
  }

  const handleBuyNow = () => {
    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "옵션을 선택해주세요",
        description: "색상과 사이즈를 선택해주세요.",
      })
      return
    }

    selectedItems.forEach((item) => {
      const option = options.find((o) => o.id === item.optionId)
      if (!option) return
      addItem({
        product_id: productId,
        product_option_id: item.optionId,
        product_name: productName,
        product_image: productImage,
        color: item.color,
        size: item.size,
        price: basePrice,
        extra_price: option.extra_price,
        quantity: item.quantity,
        stock: item.stock,
      })
    })

    router.push("/cart")
  }

  return (
    <div className="space-y-6">
      {/* 색상 선택 */}
      <div>
        <p className="text-sm font-medium mb-2">
          색상 {selectedColor && <span className="text-muted-foreground">: {selectedColor}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => {
                setSelectedColor(color)
                setSelectedSize(null)
              }}
              className={cn(
                "px-4 py-2 rounded-md border text-sm transition-colors",
                selectedColor === color
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      {/* 사이즈 선택 */}
      {selectedColor && (
        <div>
          <p className="text-sm font-medium mb-2">사이즈</p>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.stock > 0) {
                    setSelectedSize(opt.size)
                  }
                }}
                disabled={opt.stock === 0}
                className={cn(
                  "px-4 py-2 rounded-md border text-sm transition-colors relative",
                  selectedSize === opt.size
                    ? "border-primary bg-primary/5 text-primary"
                    : opt.stock === 0
                      ? "bg-gray-100 text-gray-300 cursor-not-allowed line-through border-transparent"
                      : "border-border hover:border-muted-foreground/50"
                )}
              >
                {opt.size}
                {opt.stock > 0 && opt.stock <= 5 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-2 -right-2 text-[10px] px-1 py-0"
                  >
                    {opt.stock}개
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 옵션 리스트 */}
      {selectedItems.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          {selectedItems.map((item) => (
            <div
              key={item.optionId}
              className={cn(
                "flex items-center justify-between p-3 bg-muted/30 rounded-md border transition-all duration-300",
                highlightId === item.optionId
                  ? "border-primary animate-pulse"
                  : "border-transparent"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {item.color} / {item.size}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center border rounded-md bg-white">
                  <button
                    onClick={() => updateQuantity(item.optionId, -1)}
                    className="p-1.5 hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.optionId, 1)}
                    className="p-1.5 hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm font-medium w-20 text-right">
                  {(item.unitPrice * item.quantity).toLocaleString()}원
                </span>
                <button
                  onClick={() => removeItem(item.optionId)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* 총 금액 */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              총 상품금액 ({selectedItems.reduce((s, i) => s + i.quantity, 0)}개)
            </span>
            <span className="text-xl font-bold">
              {totalPrice.toLocaleString()}원
            </span>
          </div>
        </div>
      )}

      {/* 버튼 — PC */}
      <div className="hidden md:flex gap-3">
        <Button
          variant="outline"
          className="w-[40%]"
          size="lg"
          onClick={handleAddToCart}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          장바구니
        </Button>
        <Button className="w-[60%]" size="lg" onClick={handleBuyNow}>
          바로구매
        </Button>
      </div>

      {/* 버튼 — 모바일 하단 고정 */}
      <div className="fixed bottom-[60px] left-0 right-0 z-40 bg-white border-t shadow-lg py-3 px-4 flex gap-3 md:hidden pb-[calc(12px+env(safe-area-inset-bottom))]">
        <Button
          variant="outline"
          className="w-[40%]"
          onClick={handleAddToCart}
        >
          장바구니
        </Button>
        <Button className="w-[60%]" onClick={handleBuyNow}>
          바로구매
        </Button>
      </div>
    </div>
  )
}

export default ProductOptions
