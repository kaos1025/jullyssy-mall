"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronDown, ChevronUp } from "lucide-react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "@/hooks/use-cart"
import { calculateShippingFee } from "@/constants/shipping"
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
  const router = useRouter()
  const { items } = useCart()
  const [mounted, setMounted] = useState(false)
  const [orderOptionIds, setOrderOptionIds] = useState<string[] | null>(null)

  const [showItems, setShowItems] = useState(true)
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
    try {
      const raw = sessionStorage.getItem("checkout_option_ids")
      if (raw) setOrderOptionIds(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get("error")
    if (!errorCode) return

    const errorMessages: Record<string, string> = {
      amount_mismatch:
        "결제 금액에 문제가 발생했습니다. 처음부터 다시 시도해주세요.",
      order_state_invalid:
        "이미 처리된 주문입니다. 마이페이지에서 확인해주세요.",
      order_not_found: "주문을 찾을 수 없습니다.",
      invalid_params: "결제 요청 정보가 올바르지 않습니다.",
      payment_failed: "결제에 실패했습니다. 다시 시도해주세요.",
      server_error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    }

    toast({
      variant: "destructive",
      title: "결제 처리 실패",
      description: errorMessages[errorCode] || "결제 처리 중 오류가 발생했습니다.",
    })

    // 메시지 노출 후 URL 정리 (새로고침/뒤로가기 시 재노출 방지)
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, "", cleanUrl)
  }, [toast])

  // orderOptionIds === null → 직접 진입 fallback(전체). 기존 동작과 동일해 회귀 없음
  const orderItems = useMemo(
    () =>
      orderOptionIds
        ? items.filter((i) => orderOptionIds.includes(i.product_option_id))
        : items,
    [items, orderOptionIds]
  )

  const subtotal = mounted
    ? orderItems
        .filter((i) => !i.soldout)
        .reduce((s, i) => s + (i.price + i.extra_price) * i.quantity, 0)
    : 0
  const hasFreeShippingItem =
    mounted && orderItems.some((item) => item.free_shipping)
  const shippingFee = calculateShippingFee(subtotal, { hasFreeShippingItem })
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

    if (orderItems.length === 0) return

    setLoading(true)

    // catch에서 PENDING cleanup 호출에 사용 — try 외부 closure
    let createdOrderId: string | null = null

    try {
      // 0. 새 배송지 저장 (체크한 경우)
      const saveAddr = (window as unknown as Record<string, unknown>)
        .__saveNewAddress as (() => Promise<void>) | undefined
      if (saveAddr) await saveAddr()

      // 1. 주문 생성
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderItems.map((item) => ({
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
      createdOrderId = order_id

      // 2. 토스페이먼츠 결제 요청
      const { loadTossPayments } = await import(
        "@tosspayments/tosspayments-sdk"
      )
      const toss = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
      )
      const payment = toss.payment({ customerKey: order_id })

      // 토스 v2 SDK 결제수단 분기 — RequestPayment intersection 함수에
      // discriminated union으로 매칭되도록 method별 직접 호출.
      // - CARD + flowMode:DEFAULT: 카드/간편결제 통합결제창
      // - CARD + flowMode:DIRECT + easyPay: 간편결제 provider 바로 진입
      // - TRANSFER: 퀵계좌이체 결제창 (별도 method — CARD 매핑 시 통합결제창엔 계좌이체 없음)
      const baseRequest = {
        amount: { currency: "KRW" as const, value: paid_amount },
        orderId: order_no,
        orderName:
          orderItems.length === 1
            ? orderItems[0].product_name
            : `${orderItems[0].product_name} 외 ${orderItems.length - 1}건`,
        successUrl: `${window.location.origin}/api/payments/confirm?order_id=${order_id}`,
        failUrl: `${window.location.origin}/checkout?error=payment_failed`,
      }

      switch (paymentMethod) {
        case "CARD":
          await payment.requestPayment({
            method: "CARD",
            card: { flowMode: "DEFAULT" },
            ...baseRequest,
          })
          break
        case "TRANSFER":
          await payment.requestPayment({
            method: "TRANSFER",
            ...baseRequest,
          })
          break
        case "KAKAOPAY":
          await payment.requestPayment({
            method: "CARD",
            card: { flowMode: "DIRECT", easyPay: "KAKAOPAY" },
            ...baseRequest,
          })
          break
        case "NAVERPAY":
          await payment.requestPayment({
            method: "CARD",
            card: { flowMode: "DIRECT", easyPay: "NAVERPAY" },
            ...baseRequest,
          })
          break
      }
    } catch (error) {
      // 토스 SDK는 UserCancelError를 throw하지만 `.d.ts`에 런타임 code 값이 노출돼 있지 않다.
      // 공식 문서 기준 USER_CANCEL / PAY_PROCESS_CANCELED 두 코드를 모두 받고, 마지막 안전책으로
      // message에 "취소"가 포함되는지도 확인 (이전 동작 호환).
      const err = error as { code?: string | null; message?: string } | null
      const code = err?.code ?? ""
      const message = err?.message ?? "결제 처리 중 오류가 발생했습니다"
      const isUserCancel =
        code === "USER_CANCEL" ||
        code === "PAY_PROCESS_CANCELED" ||
        message.includes("취소")

      // PENDING 주문 cleanup — 사용자 취소든 일반 에러든 결제 confirm 미진입 PENDING은 정리되어야 한다.
      // 실패 시 cron(033)이 30분 후 만료 처리하므로 best-effort 호출로 충분.
      if (createdOrderId) {
        fetch(`/api/orders/${createdOrderId}/cleanup-pending`, {
          method: "POST",
        }).catch(() => {})
      }

      if (isUserCancel) {
        toast({ title: "결제가 취소되었습니다" })
        router.push("/cart")
      } else {
        Sentry.captureException(error, {
          tags: {
            payment_error_code: code || "unknown",
            payment_method: paymentMethod,
          },
        })
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

  if (orderItems.length === 0) {
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
                주문 상품 ({orderItems.length}개)
              </h3>
              {showItems ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showItems && (
              <div className="mt-3 space-y-3">
                {orderItems.map((item) => (
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
