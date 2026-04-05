"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ORDER_STATUS_LABEL } from "@/constants"
import type { OrderWithItems } from "@/types"

const COURIER_TRACKING_URL: Record<string, string> = {
  CJ대한통운: "https://trace.cjlogistics.com/web/detail.jsp?slipno=",
  롯데택배: "https://www.lotteglogis.com/home/reservation/tracking/link498?InvNo=",
  한진택배: "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mession-id=&wblnumText2=&schLang=KR&wblnumText=",
}

const OrderDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  useEffect(() => {
    const fetchOrder = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*), payment:payments(*)")
        .eq("id", params.id)
        .single()

      if (data) {
        setOrder({
          ...data,
          items: data.items || [],
          payment: data.payment?.[0] || null,
        } as unknown as OrderWithItems)
      }
      setLoading(false)
    }
    fetchOrder()
  }, [params.id])

  const handleAction = async (action: "cancel" | "confirm") => {
    if (!order) return
    setActionLoading(true)

    const res = await fetch(`/api/orders/${order.id}/${action}`, {
      method: "POST",
    })

    if (res.ok) {
      toast({
        title: action === "cancel" ? "취소 신청 완료" : "구매확정 완료",
        description:
          action === "confirm"
            ? "포인트가 적립되었습니다."
            : "취소가 처리됩니다.",
      })
      router.refresh()
      // 새로고침
      const supabase = createClient()
      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items(*), payment:payments(*)")
        .eq("id", order.id)
        .single()
      if (data) {
        setOrder({
          ...data,
          items: data.items || [],
          payment: data.payment?.[0] || null,
        } as unknown as OrderWithItems)
      }
    } else {
      const err = await res.json()
      toast({
        variant: "destructive",
        title: "처리 실패",
        description: err.error,
      })
    }

    setActionLoading(false)
  }

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">로딩 중...</div>
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        주문을 찾을 수 없습니다.
      </div>
    )
  }

  const canCancel = ["PAID", "PREPARING"].includes(order.status)
  const canConfirm = order.status === "DELIVERED"
  const canReturn = order.status === "DELIVERED"

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">주문 상세</h2>
          <p className="text-sm text-muted-foreground">{order.order_no}</p>
        </div>
        <Badge>
          {ORDER_STATUS_LABEL[order.status] || order.status}
        </Badge>
      </div>

      {/* 상품 목록 */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">주문 상품</h3>
        {order.items.map((item) => (
          <div key={item.id} className="flex gap-3 py-2 border-t first:border-0">
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
            <div className="flex-1">
              <p className="text-sm">{item.product_name}</p>
              <p className="text-xs text-muted-foreground">
                {item.color}/{item.size} · {item.quantity}개
              </p>
              <p className="text-sm font-medium">
                {(item.price * item.quantity).toLocaleString()}원
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 배송 정보 */}
      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="font-medium text-sm">배송 정보</h3>
        <p className="text-sm">
          {order.recipient} / {order.recipient_phone}
        </p>
        <p className="text-sm text-muted-foreground">
          [{order.zipcode}] {order.address1} {order.address2 || ""}
        </p>
        {order.delivery_memo && (
          <p className="text-sm text-muted-foreground">
            메모: {order.delivery_memo}
          </p>
        )}
        {order.courier && order.tracking_no && (
          <div className="pt-2">
            <Separator className="mb-2" />
            <p className="text-sm">
              {order.courier}{" "}
              <a
                href={`${COURIER_TRACKING_URL[order.courier] || ""}${order.tracking_no}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {order.tracking_no}
              </a>
            </p>
          </div>
        )}
      </div>

      {/* 결제 정보 */}
      <div className="border rounded-lg p-4 space-y-2 text-sm">
        <h3 className="font-medium">결제 정보</h3>
        <div className="flex justify-between">
          <span className="text-muted-foreground">총 상품금액</span>
          <span>{order.total_amount.toLocaleString()}원</span>
        </div>
        {order.discount_amount > 0 && (
          <div className="flex justify-between text-primary">
            <span>할인</span>
            <span>-{order.discount_amount.toLocaleString()}원</span>
          </div>
        )}
        {order.point_used > 0 && (
          <div className="flex justify-between text-primary">
            <span>포인트 사용</span>
            <span>-{order.point_used.toLocaleString()}원</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">배송비</span>
          <span>
            {order.shipping_fee === 0
              ? "무료"
              : `${order.shipping_fee.toLocaleString()}원`}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-base">
          <span>결제금액</span>
          <span>{order.paid_amount.toLocaleString()}원</span>
        </div>
      </div>

      {/* 액션 버튼 */}
      {(canCancel || canConfirm || canReturn) && (
        <div className="flex gap-3">
          {canCancel && (
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              disabled={actionLoading}
            >
              취소 신청
            </Button>
          )}
          {canConfirm && (
            <Button
              onClick={() => handleAction("confirm")}
              disabled={actionLoading}
            >
              구매확정
            </Button>
          )}
          {canReturn && (
            <Button variant="outline" disabled={actionLoading}>
              교환/반품 신청
            </Button>
          )}
        </div>
      )}

      {/* 취소 확인 Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주문을 취소하시겠습니까?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            정말 주문을 취소하시겠습니까? 취소된 주문은 복구할 수 없습니다.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={actionLoading}
            >
              닫기
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await handleAction("cancel")
                setCancelDialogOpen(false)
              }}
              disabled={actionLoading}
            >
              {actionLoading ? "처리 중..." : "취소 신청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OrderDetailPage
