"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import dayjs from "dayjs"
import type { UserCouponWithDetails } from "@/types"

type FilterType = "available" | "used" | "expired"

const MyCouponsPage = () => {
  const { toast } = useToast()
  const [coupons, setCoupons] = useState<UserCouponWithDetails[]>([])
  const [filter, setFilter] = useState<FilterType>("available")
  const [loading, setLoading] = useState(true)
  const [claimCode, setClaimCode] = useState("")
  const [claimLoading, setClaimLoading] = useState(false)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/my/coupons?filter=${filter}`)
    const data = await res.json()
    if (!data.error) setCoupons(data)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const handleClaim = async () => {
    if (!claimCode.trim()) return
    setClaimLoading(true)

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
    } else {
      toast({ title: `"${data.coupon_name}" 쿠폰이 등록되었습니다` })
      setClaimCode("")
      fetchCoupons()
    }

    setClaimLoading(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">쿠폰</h2>

      {/* 쿠폰 코드 등록 */}
      <div className="flex gap-2">
        <Input
          placeholder="쿠폰 코드 입력"
          value={claimCode}
          onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleClaim()}
          disabled={claimLoading}
          className="flex-1"
        />
        <Button
          onClick={handleClaim}
          disabled={claimLoading || !claimCode.trim()}
        >
          {claimLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "쿠폰 등록"
          )}
        </Button>
      </div>

      {/* 탭 */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterType)}
      >
        <TabsList>
          <TabsTrigger value="available">사용 가능</TabsTrigger>
          <TabsTrigger value="used">사용 완료</TabsTrigger>
          <TabsTrigger value="expired">만료</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 쿠폰 목록 */}
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">
          로딩 중...
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {filter === "available"
            ? "사용 가능한 쿠폰이 없습니다."
            : filter === "used"
              ? "사용한 쿠폰이 없습니다."
              : "만료된 쿠폰이 없습니다."}
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((uc) => {
            const coupon = uc.coupon
            const isUsed = !!uc.used_at
            const isExpired =
              !isUsed &&
              coupon.expires_at &&
              dayjs(coupon.expires_at).isBefore(dayjs())

            return (
              <div
                key={uc.id}
                className={`border rounded-lg p-4 ${
                  isUsed || isExpired ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium">{coupon.name}</p>
                    <p className="text-primary font-bold text-lg">
                      {coupon.type === "FIXED"
                        ? `${coupon.value.toLocaleString()}원`
                        : `${coupon.value}%`}
                      {" 할인"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {coupon.min_order_price > 0 && (
                        <span>
                          {coupon.min_order_price.toLocaleString()}원 이상
                          주문 시
                        </span>
                      )}
                      {coupon.max_discount && (
                        <span>
                          최대 {coupon.max_discount.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dayjs(coupon.starts_at).format("YYYY.MM.DD")} ~{" "}
                      {coupon.expires_at
                        ? dayjs(coupon.expires_at).format("YYYY.MM.DD")
                        : "무기한"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      isUsed
                        ? "secondary"
                        : isExpired
                          ? "destructive"
                          : "default"
                    }
                  >
                    {isUsed
                      ? "사용완료"
                      : isExpired
                        ? "만료"
                        : "사용가능"}
                  </Badge>
                </div>
                {isUsed && uc.used_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    사용일: {dayjs(uc.used_at).format("YYYY.MM.DD")}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default MyCouponsPage
