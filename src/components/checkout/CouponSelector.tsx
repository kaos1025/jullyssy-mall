"use client"

import { useState, useEffect } from "react"
import { Ticket, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import type { UserCouponWithDetails } from "@/types"

interface CouponSelectorProps {
  orderAmount: number
  onApply: (discount: number, couponId: string | null) => void
}

const CouponSelector = ({ orderAmount, onApply }: CouponSelectorProps) => {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<UserCouponWithDetails[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [validateLoading, setValidateLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [claimCode, setClaimCode] = useState("")
  const [serverDiscount, setServerDiscount] = useState(0)

  // 쿠폰 목록 조회
  const fetchCoupons = async () => {
    setFetchLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("user_coupons")
      .select("*, coupon:coupons(*)")
      .is("used_at", null)

    if (data) {
      setCoupons(data as unknown as UserCouponWithDetails[])
    }
    setFetchLoading(false)
  }

  useEffect(() => {
    fetchCoupons()
  }, [])

  // UI 표시용 클라이언트 계산 (Dialog 내 미리보기)
  const previewDiscount = (coupon: UserCouponWithDetails["coupon"]) => {
    if (orderAmount < coupon.min_order_price) return 0
    if (coupon.type === "FIXED") return Math.min(coupon.value, orderAmount)
    const percent = Math.floor((orderAmount * coupon.value) / 100)
    const capped = coupon.max_discount
      ? Math.min(percent, coupon.max_discount)
      : percent
    return Math.min(capped, orderAmount)
  }

  // 서버 validate 호출 → 결과를 부모에 반영
  const validateAndApply = async (userCouponId: string) => {
    setValidateLoading(true)
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coupon_id: userCouponId,
          order_total_price: orderAmount,
        }),
      })
      const data = await res.json()

      if (data.valid) {
        setSelectedId(userCouponId)
        setServerDiscount(data.discount_amount)
        onApply(data.discount_amount, userCouponId)
        setOpen(false)
      } else {
        toast({
          variant: "destructive",
          title: "쿠폰 적용 불가",
          description: data.message,
        })
      }
    } catch {
      toast({ variant: "destructive", title: "쿠폰 검증 실패" })
    } finally {
      setValidateLoading(false)
    }
  }

  // 쿠폰 선택
  const handleSelect = (userCoupon: UserCouponWithDetails) => {
    const preview = previewDiscount(userCoupon.coupon)
    if (preview === 0) return
    validateAndApply(userCoupon.id)
  }

  // 쿠폰 해제
  const handleRemove = () => {
    setSelectedId(null)
    setServerDiscount(0)
    onApply(0, null)
  }

  // 쿠폰 코드 입력 → claim → validate → apply
  const handleClaim = async () => {
    if (!claimCode.trim()) return
    setClaimLoading(true)

    try {
      const res = await fetch("/api/coupons/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: claimCode.trim() }),
      })
      const data = await res.json()

      if (data.error) {
        toast({
          variant: "destructive",
          title: "쿠폰 등록 실패",
          description: data.error,
        })
        setClaimLoading(false)
        return
      }

      // claim 성공 → 목록 갱신 + 바로 validate
      toast({ title: `"${data.coupon_name}" 쿠폰이 등록되었습니다` })
      setClaimCode("")
      await fetchCoupons()
      await validateAndApply(data.user_coupon_id)
    } catch {
      toast({ variant: "destructive", title: "쿠폰 등록 실패" })
    } finally {
      setClaimLoading(false)
    }
  }

  const selected = coupons.find((c) => c.id === selectedId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">쿠폰</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Ticket className="h-3.5 w-3.5 mr-1" />
              {fetchLoading
                ? "쿠폰 불러오는 중..."
                : `쿠폰 선택 (${coupons.length})`}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>쿠폰 선택</DialogTitle>
            </DialogHeader>

            {/* 쿠폰 코드 입력 */}
            <div className="flex gap-2">
              <Input
                placeholder="쿠폰 코드 입력"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleClaim()}
                disabled={claimLoading}
              />
              <Button
                onClick={handleClaim}
                disabled={claimLoading || !claimCode.trim()}
                variant="outline"
              >
                {claimLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "적용"
                )}
              </Button>
            </div>

            <Separator />

            {/* 보유 쿠폰 목록 */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {fetchLoading ? (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  쿠폰 불러오는 중...
                </p>
              ) : coupons.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  사용 가능한 쿠폰이 없습니다.
                </p>
              ) : (
                coupons.map((uc) => {
                  const preview = previewDiscount(uc.coupon)
                  const isAvailable = preview > 0
                  const isSelected = selectedId === uc.id
                  return (
                    <button
                      key={uc.id}
                      onClick={() => isAvailable && handleSelect(uc)}
                      disabled={!isAvailable || validateLoading}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        !isAvailable
                          ? "opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{uc.coupon.name}</p>
                      <p className="text-primary font-bold">
                        {uc.coupon.type === "FIXED"
                          ? `${uc.coupon.value.toLocaleString()}원`
                          : `${uc.coupon.value}%`}
                        {" 할인"}
                        {isAvailable && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            (-{preview.toLocaleString()}원)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {uc.coupon.min_order_price > 0 &&
                          `${uc.coupon.min_order_price.toLocaleString()}원 이상 주문 시`}
                        {uc.coupon.max_discount &&
                          ` / 최대 ${uc.coupon.max_discount.toLocaleString()}원`}
                      </p>
                      {!isAvailable && (
                        <p className="text-xs text-destructive mt-1">
                          {orderAmount < uc.coupon.min_order_price
                            ? `${uc.coupon.min_order_price.toLocaleString()}원 이상 주문 시 사용 가능`
                            : "사용 불가"}
                        </p>
                      )}
                    </button>
                  )
                })
              )}
              {validateLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  쿠폰 적용 중...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 선택된 쿠폰 표시 */}
      {selected && (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div>
            <p className="text-sm font-medium">{selected.coupon.name}</p>
            <p className="text-sm text-primary font-bold">
              -{serverDiscount.toLocaleString()}원
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            취소
          </Button>
        </div>
      )}
    </div>
  )
}

export default CouponSelector
