"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/hooks/use-cart"
import { cn } from "@/lib/utils"
import type { ProductOption } from "@/types"

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
  const [quantity, setQuantity] = useState(1)

  const colors = Array.from(new Set(options.map((o) => o.color)))
  const availableSizes = selectedColor
    ? options.filter((o) => o.color === selectedColor)
    : []

  const selectedOption =
    selectedColor && selectedSize
      ? options.find(
          (o) => o.color === selectedColor && o.size === selectedSize
        )
      : null

  const basePrice = salePrice ?? price
  const totalPrice = selectedOption
    ? (basePrice + selectedOption.extra_price) * quantity
    : basePrice

  const handleAddToCart = () => {
    if (!selectedOption) {
      toast({
        variant: "destructive",
        title: "옵션을 선택해주세요",
        description: "색상과 사이즈를 선택해주세요.",
      })
      return
    }

    addItem({
      product_id: productId,
      product_option_id: selectedOption.id,
      product_name: productName,
      product_image: productImage,
      color: selectedOption.color,
      size: selectedOption.size,
      price: basePrice,
      extra_price: selectedOption.extra_price,
      quantity,
      stock: selectedOption.stock,
    })

    toast({
      title: "장바구니에 추가했습니다",
      description: `${productName} (${selectedColor}/${selectedSize})`,
    })
  }

  const handleBuyNow = () => {
    if (!selectedOption) {
      toast({
        variant: "destructive",
        title: "옵션을 선택해주세요",
        description: "색상과 사이즈를 선택해주세요.",
      })
      return
    }

    handleAddToCart()
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
                setQuantity(1)
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
                    setQuantity(1)
                  }
                }}
                disabled={opt.stock === 0}
                className={cn(
                  "px-4 py-2 rounded-md border text-sm transition-colors relative",
                  selectedSize === opt.size
                    ? "border-primary bg-primary/5 text-primary"
                    : opt.stock === 0
                      ? "border-border text-muted-foreground/40 cursor-not-allowed line-through"
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

      {/* 수량 */}
      {selectedOption && (
        <div>
          <p className="text-sm font-medium mb-2">수량</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 hover:bg-muted transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-sm">{quantity}</span>
              <button
                onClick={() =>
                  setQuantity(Math.min(selectedOption.stock, quantity + 1))
                }
                className="p-2 hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">
              (재고 {selectedOption.stock}개)
            </span>
          </div>
        </div>
      )}

      {/* 가격 */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">총 상품금액</span>
          <span className="text-xl font-bold">
            {totalPrice.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 버튼 — PC */}
      <div className="hidden md:flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          size="lg"
          onClick={handleAddToCart}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          장바구니
        </Button>
        <Button className="flex-1" size="lg" onClick={handleBuyNow}>
          바로구매
        </Button>
      </div>

      {/* 버튼 — 모바일 하단 고정 */}
      <div className="fixed bottom-14 left-0 right-0 z-40 bg-background border-t p-3 flex gap-3 md:hidden">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleAddToCart}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          장바구니
        </Button>
        <Button className="flex-1" onClick={handleBuyNow}>
          바로구매
        </Button>
      </div>
    </div>
  )
}

export default ProductOptions
