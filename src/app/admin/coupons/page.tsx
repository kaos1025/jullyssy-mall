"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import dayjs from "dayjs"
import type { Coupon } from "@/types"

const AdminCouponsPage = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCoupons = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false })

      if (data) setCoupons(data)
      setLoading(false)
    }
    fetchCoupons()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">쿠폰 관리</h1>
        <Button asChild>
          <Link href="/admin/coupons/new">
            <Plus className="h-4 w-4 mr-2" />
            쿠폰 생성
          </Link>
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">쿠폰명</th>
              <th className="p-3 text-left">코드</th>
              <th className="p-3 text-center">타입</th>
              <th className="p-3 text-right">할인</th>
              <th className="p-3 text-right hidden md:table-cell">조건</th>
              <th className="p-3 text-center hidden md:table-cell">발급</th>
              <th className="p-3 text-left hidden md:table-cell">유효기간</th>
              <th className="p-3 text-center">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  쿠폰이 없습니다.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => {
                const isExpired = dayjs(coupon.expires_at).isBefore(dayjs())
                return (
                  <tr key={coupon.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{coupon.name}</td>
                    <td className="p-3 font-mono text-xs">{coupon.code}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline">
                        {coupon.type === "FIXED" ? "정액" : "정률"}
                      </Badge>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {coupon.type === "FIXED"
                        ? `${coupon.discount_value.toLocaleString()}원`
                        : `${coupon.discount_value}%`}
                    </td>
                    <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                      {coupon.min_order_amount > 0
                        ? `${coupon.min_order_amount.toLocaleString()}원↑`
                        : "-"}
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      {coupon.issued_count}
                      {coupon.max_issues && `/${coupon.max_issues}`}
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {dayjs(coupon.starts_at).format("MM/DD")} ~{" "}
                      {dayjs(coupon.expires_at).format("MM/DD")}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          isExpired
                            ? "secondary"
                            : coupon.is_active
                              ? "default"
                              : "destructive"
                        }
                      >
                        {isExpired ? "만료" : coupon.is_active ? "활성" : "비활성"}
                      </Badge>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminCouponsPage
