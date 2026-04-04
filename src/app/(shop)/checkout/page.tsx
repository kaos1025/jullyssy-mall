"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/hooks/use-cart"
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/constants"
import AddressSelector from "@/components/checkout/AddressSelector"
import CouponSelector from "@/components/checkout/CouponSelector"
import PointInput from "@/components/checkout/PointInput"

type PaymentMethodType = "CARD" | "TRANSFER" | "KAKAOPAY" | "NAVERPAY"

const paymentMethods: { value: PaymentMethodType; label: string }[] = [
  { value: "CARD", label: "신용카드" },
  { value: "TRANSFER", label: "계좌이체" },
  { value: "KAKAOPAY", label: "카카오페이" },
  { value: "NAVERPAY", label: "네이버페이" },
]

const CheckoutPage = () => {
  const { toast } = useToast()
  const { items, getTotal } = useCart()
  const [mounted, setMounted] = useState(false)

  const [showItems, setShowItems] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CARD")
  const [loading, setLoading] = useState(false)

  // 주소 상태
  const [address, setAddress] = useState({
    recipient: "",
    phone: "",
    zipcode: "",
    address1: "",
    address2: "",
    memo: "",
  })

  // 결제 동의
  const [orderAgreed, setOrderAgreed] = useState(false)

  // 할인
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponId, setCouponId] = useState<string | null>(null)
  const [pointUsed, setPointUsed] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const subtotal = mounted ? getTotal() : 0
  const shippingFee =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : subtotal > 0 ? SHIPPING_FEE : 0
  const totalDiscount = couponDiscount + pointUsed
  const finalAmount = subtotal - totalDiscount + shippingFee

  const handleCouponApply = useCallback(
    (discount: number, id: string | null) => {
      setCouponDiscount(discount)
      setCouponId(id)
    },
    []
  )

  const handlePayment = async () => {
    if (!address.recipient || !address.zipcode) {
      toast({
        variant: "destructive",
        title: "배송지를 입력해주세요",
      })
      return
    }

    if (!orderAgreed) {
      toast({
        variant: "destructive",
        title: "결제 동의가 필요합니다",
      })
      return
    }

    if (items.length === 0) return

    setLoading(true)

    try {
      // 1. 주문 생성
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.product_id,
            product_option_id: item.product_option_id,
            product_name: item.product_name,
            product_image: item.product_image,
            color: item.color,
            size: item.size,
            price: item.price + item.extra_price,
            quantity: item.quantity,
          })),
          address,
          coupon_id: couponId,
          point_used: pointUsed,
          payment_method: paymentMethod,
          shipping_fee: shippingFee,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "주문 생성 실패")
      }

      const { order_id, order_no, paid_amount } = await res.json()

      // 2. 토스페이먼츠 결제 요청
      const { loadTossPayments } = await import(
        "@tosspayments/tosspayments-sdk"
      )
      const toss = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
      )
      const payment = toss.payment({ customerKey: order_id })

      const methodMap: Record<PaymentMethodType, string> = {
        CARD: "CARD",
        TRANSFER: "TRANSFER",
        KAKAOPAY: "EASYPAY",
        NAVERPAY: "EASYPAY",
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (payment as any).requestPayment({
        method: methodMap[paymentMethod],
        amount: { currency: "KRW", value: paid_amount },
        orderId: order_no,
        orderName:
          items.length === 1
            ? items[0].product_name
            : `${items[0].product_name} 외 ${items.length - 1}건`,
        successUrl: `${window.location.origin}/api/payments/confirm?order_id=${order_id}`,
        failUrl: `${window.location.origin}/checkout?error=payment_failed`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "결제 처리 중 오류가 발생했습니다"
      if (!message.includes("취소")) {
        toast({
          variant: "destructive",
          title: "결제 실패",
          description: message,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div className="container py-8">
        <h1 className="text-xl font-bold mb-6">주문서</h1>
        <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container py-8">
        <h1 className="text-xl font-bold mb-6">주문서</h1>
        <div className="text-center py-20 text-muted-foreground">
          주문할 상품이 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="text-xl font-bold mb-6">주문서</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* 배송지 */}
          <AddressSelector onSelect={setAddress} />

          <Separator />

          {/* 주문 상품 */}
          <div>
            <button
              onClick={() => setShowItems(!showItems)}
              className="flex items-center justify-between w-full"
            >
              <h3 className="font-semibold">
                주문 상품 ({items.length}개)
              </h3>
              {showItems ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showItems && (
              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.product_option_id}
                    className="flex gap-3 py-2"
                  >
                    <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden rounded bg-muted">
                      {item.product_image && (
                        <Image
                          src={item.product_image}
                          alt={item.product_name}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-1">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.color}/{item.size} · {item.quantity}개
                      </p>
                      <p className="text-sm font-medium">
                        {(
                          (item.price + item.extra_price) *
                          item.quantity
                        ).toLocaleString()}
                        원
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* 쿠폰 */}
          <CouponSelector
            orderAmount={subtotal}
            onApply={handleCouponApply}
          />

          <Separator />

          {/* 포인트 */}
          <PointInput
            orderAmount={subtotal - couponDiscount}
            onApply={setPointUsed}
          />

          <Separator />

          {/* 결제 수단 */}
          <div>
            <h3 className="font-semibold mb-3">결제 수단</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`p-3 rounded-lg border text-sm text-center transition-colors ${
                    paymentMethod === m.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 결제 요약 */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 border rounded-lg p-6 space-y-4">
            <h2 className="font-bold">결제금액</h2>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">총 상품금액</span>
                <span>{subtotal.toLocaleString()}원</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>쿠폰 할인</span>
                  <span>-{couponDiscount.toLocaleString()}원</span>
                </div>
              )}
              {pointUsed > 0 && (
                <div className="flex justify-between text-primary">
                  <span>포인트 사용</span>
                  <span>-{pointUsed.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">배송비</span>
                <span>
                  {shippingFee === 0
                    ? "무료"
                    : `${shippingFee.toLocaleString()}원`}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>최종 결제금액</span>
              <span>{finalAmount.toLocaleString()}원</span>
            </div>
            {/* 결제 동의 */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="orderAgree"
                  checked={orderAgreed}
                  onCheckedChange={(checked) => setOrderAgreed(!!checked)}
                  className="mt-0.5"
                />
                <Label htmlFor="orderAgree" className="text-sm leading-snug">
                  주문 내용을 확인했으며, 아래 내용에 동의합니다.
                </Label>
              </div>
              <div className="ml-6 mt-2 space-y-1 text-xs text-muted-foreground">
                <p>
                  · 개인정보 수집·이용 동의{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="underline"
                  >
                    (보기)
                  </Link>
                </p>
                <p>· 개인정보 제3자 제공 동의 (배송업체, 결제대행사)</p>
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handlePayment}
              disabled={loading || !orderAgreed}
            >
              {loading ? "처리 중..." : `${finalAmount.toLocaleString()}원 결제하기`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CheckoutPage
