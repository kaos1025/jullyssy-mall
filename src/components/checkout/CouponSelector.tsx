"use client"

import { useState, useEffect } from "react"
import { Ticket } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import type { UserCouponWithDetails } from "@/types"

interface CouponSelectorProps {
  orderAmount: number
  onApply: (discount: number, couponId: string | null) => void
}

const CouponSelector = ({ orderAmount, onApply }: CouponSelectorProps) => {
  const [coupons, setCoupons] = useState<UserCouponWithDetails[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const fetchCoupons = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("user_coupons")
        .select("*, coupon:coupons(*)")
        .is("used_at", null)

      if (data) {
        setCoupons(data as unknown as UserCouponWithDetails[])
      }
    }
    fetchCoupons()
  }, [])

  const calculateDiscount = (coupon: UserCouponWithDetails["coupon"]) => {
    if (orderAmount < coupon.min_order_amount) return 0
    if (coupon.type === "FIXED") return coupon.discount_value
    const percent = Math.round((orderAmount * coupon.discount_value) / 100)
    return coupon.max_discount ? Math.min(percent, coupon.max_discount) : percent
  }

  const handleSelect = (userCoupon: UserCouponWithDetails) => {
    const discount = calculateDiscount(userCoupon.coupon)
    if (discount === 0) return

    setSelectedId(userCoupon.id)
    onApply(discount, userCoupon.id)
    setOpen(false)
  }

  const handleRemove = () => {
    setSelectedId(null)
    onApply(0, null)
  }

  const selected = coupons.find((c) => c.id === selectedId)
  const selectedDiscount = selected
    ? calculateDiscount(selected.coupon)
    : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">쿠폰</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Ticket className="h-3.5 w-3.5 mr-1" />
              쿠폰 선택 ({coupons.length})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>쿠폰 선택</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {coupons.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  사용 가능한 쿠폰이 없습니다.
                </p>
              ) : (
                coupons.map((uc) => {
                  const discount = calculateDiscount(uc.coupon)
                  const isAvailable = discount > 0
                  return (
                    <button
                      key={uc.id}
                      onClick={() => isAvailable && handleSelect(uc)}
                      disabled={!isAvailable}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        !isAvailable
                          ? "opacity-50 cursor-not-allowed"
                          : selectedId === uc.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{uc.coupon.name}</p>
                      <p className="text-primary font-bold">
                        {uc.coupon.type === "FIXED"
                          ? `${uc.coupon.discount_value.toLocaleString()}원`
                          : `${uc.coupon.discount_value}%`}
                        {" 할인"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {uc.coupon.min_order_amount > 0 &&
                          `${uc.coupon.min_order_amount.toLocaleString()}원 이상 주문 시`}
                        {uc.coupon.max_discount &&
                          ` / 최대 ${uc.coupon.max_discount.toLocaleString()}원`}
                      </p>
                      {!isAvailable && (
                        <p className="text-xs text-destructive mt-1">
                          최소 주문금액 미충족
                        </p>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selected && (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div>
            <p className="text-sm font-medium">{selected.coupon.name}</p>
            <p className="text-sm text-primary font-bold">
              -{selectedDiscount.toLocaleString()}원
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
