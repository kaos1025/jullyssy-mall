"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Minus, Plus, X, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/hooks/use-cart"
import { cn } from "@/lib/utils"
import { getColorStyle, isLightColor } from "@/constants/colors"
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
  const [sheetOpen, setSheetOpen] = useState(false)

  const colors = Array.from(new Set(options.map((o) => o.color)))
  const availableSizes = selectedColor
    ? options.filter((o) => o.color === selectedColor)
    : []

  const basePrice = salePrice ?? price

  const totalPrice = selectedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )

  useEffect(() => {
    if (!selectedColor || !selectedSize) return

    const option = options.find(
      (o) => o.color === selectedColor && o.size === selectedSize
    )
    if (!option || option.stock === 0) return

    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.optionId === option.id)
      if (existing) {
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

    setHighlightId(option.id)
    setTimeout(() => setHighlightId(null), 1500)

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

  const doAddToCart = () => {
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
    doAddToCart()
    toast({
      title: "장바구니에 담았습니다 ✓",
      action: (
        <ToastAction altText="장바구니 보기" onClick={() => router.push("/cart")}>
          장바구니 보기
        </ToastAction>
      ),
    })
    setSelectedItems([])
    setSheetOpen(false)
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
    doAddToCart()
    setSheetOpen(false)
    router.push("/cart")
  }

  const isColorSoldOut = (color: string) =>
    options.filter((o) => o.color === color).every((o) => o.stock === 0)

  // --- 공통 UI 컴포넌트 ---

  const ColorSelector = () => (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm font-medium">옵션</span>
        {selectedColor && (
          <span className="text-sm text-muted-foreground">{selectedColor}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => {
          const soldOut = isColorSoldOut(color)
          const colorStyle = getColorStyle(color)
          const light = isLightColor(color)
          return (
            <button
              key={color}
              onClick={() => {
                if (!soldOut) {
                  setSelectedColor(color)
                  setSelectedSize(null)
                }
              }}
              disabled={soldOut}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                soldOut && "opacity-40 cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full transition-all",
                  selectedColor === color
                    ? "ring-2 ring-primary ring-offset-2"
                    : light
                      ? "border border-gray-200"
                      : "border border-transparent",
                  soldOut &&
                    "bg-[length:100%_2px] bg-[linear-gradient(135deg,transparent_45%,#999_45%,#999_55%,transparent_55%)]"
                )}
                style={colorStyle}
              />
              <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[48px] truncate">
                {color}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const SizeSelector = () =>
    selectedColor ? (
      <div>
        <p className="text-sm font-medium mb-2">사이즈</p>
        <div className="flex flex-wrap gap-2">
          {availableSizes.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                if (opt.stock > 0) setSelectedSize(opt.size)
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
    ) : null

  const SelectedItemsList = () =>
    selectedItems.length > 0 ? (
      <div className="space-y-2 border-t pt-4">
        {selectedItems.map((item) => (
          <div
            key={item.optionId}
            className={cn(
              "border rounded-lg p-3 transition-all duration-300",
              highlightId === item.optionId
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
          >
            <p className="text-sm font-medium mb-2">
              {item.color} / {item.size}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.optionId, -1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(item.optionId, 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">
                  {(item.unitPrice * item.quantity).toLocaleString()}원
                </span>
                <button
                  onClick={() => removeItem(item.optionId)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-sm text-muted-foreground">
            총 상품금액 ({selectedItems.reduce((s, i) => s + i.quantity, 0)}개)
          </span>
          <span className="text-xl font-bold">
            {totalPrice.toLocaleString()}원
          </span>
        </div>
      </div>
    ) : null

  return (
    <>
      {/* === PC 인라인 === */}
      <div className="hidden md:block space-y-5">
        <ColorSelector />
        <SizeSelector />
        <SelectedItemsList />

        <div className="flex gap-3">
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
      </div>

      {/* === 모바일 바텀시트 === */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {/* 모바일 하단 고정 바 — 구매하기 버튼 */}
        <div className="fixed bottom-[60px] left-0 right-0 z-40 md:hidden pb-[env(safe-area-inset-bottom)]">
          <SheetTrigger asChild>
            <Button className="w-full h-12 rounded-none text-base font-medium">
              구매하기
            </Button>
          </SheetTrigger>
        </div>

        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-[env(safe-area-inset-bottom)]"
        >
          {/* 드래그 핸들 */}
          <div className="flex justify-center pt-2 pb-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* 상품 미니 정보 */}
          <div className="flex gap-3 mb-4">
            <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted">
              {productImage ? (
                <Image
                  src={productImage}
                  alt={productName}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No img
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-1">{productName}</p>
              <p className="text-sm font-bold mt-0.5">
                {basePrice.toLocaleString()}원
              </p>
            </div>
          </div>

          <Separator className="mb-4" />

          {/* 옵션 선택 */}
          <div className="space-y-4">
            <ColorSelector />
            <SizeSelector />
            <SelectedItemsList />
          </div>

          {/* 하단 버튼 */}
          <div className="flex gap-3 mt-5 pb-2">
            <Button
              variant="outline"
              className="w-1/2"
              size="lg"
              onClick={handleAddToCart}
            >
              장바구니 담기
            </Button>
            <Button className="w-1/2" size="lg" onClick={handleBuyNow}>
              바로구매
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default ProductOptions
