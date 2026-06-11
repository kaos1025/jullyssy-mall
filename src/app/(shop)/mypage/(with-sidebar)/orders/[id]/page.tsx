"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Check } from "lucide-react"
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
import { buildTrackingUrl } from "@/lib/order/tracking-url"
import type { OrderWithItems } from "@/types"
import {
  buildCancellationLabel,
  type CancellationActor,
  type CancellationReason,
} from "@/lib/order/cancellation"
import {
  ACTIVE_CLAIM_STATUSES,
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  type ClaimStatus,
  type ClaimType,
} from "@/lib/order/claim"
import { RETURN_CONFIG } from "@/constants/shipping"
import ClaimRequestDialog from "./ClaimRequestDialog"

type OrderClaim = {
  id: string
  type: ClaimType
  status: ClaimStatus
  reason_detail: string | null
  rejected_reason: string | null
}

type OrderWithCancellation = OrderWithItems & {
  cancellation_actor: CancellationActor | null
  cancellation_reason: CancellationReason | null
  cancellation_note: string | null
  delivered_at: string | null
  updated_at: string
  claims: OrderClaim[]
}

const OrderDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [order, setOrder] = useState<OrderWithCancellation | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)

  const fetchOrder = useCallback(async () => {
    const supabase = createClient()
    // claims는 order_claims RLS(order_claims_select_own = auth.uid()=user_id) 경유로 본인 것만 반환.
    const { data } = await supabase
      .from("orders")
      .select("*, items:order_items(*), payment:payments(*), claims:order_claims(*)")
      .eq("id", params.id)
      .single()

    if (data) {
      setOrder({
        ...data,
        items: data.items || [],
        payment: data.payment?.[0] || null,
        claims: data.claims || [],
      } as unknown as OrderWithCancellation)
    }
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

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
      await fetchOrder()
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

  const handleWithdraw = async (claimId: string) => {
    setActionLoading(true)
    const res = await fetch(`/api/claims/${claimId}/withdraw`, {
      method: "POST",
    })
    setActionLoading(false)
    if (res.ok) {
      toast({ title: "신청이 철회되었습니다" })
    } else {
      const err = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "철회 실패",
        description: err.error,
      })
    }
    // 성공/실패 무관 재조회 — 동시 어드민 처리(409 등) 시 화면을 서버 상태와 동기화.
    await fetchOrder()
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

  // 진행 중(비종결) claim 1건. 활성 claim이 있으면 신규 신청 불가.
  const activeClaim = order.claims?.find((c) =>
    ACTIVE_CLAIM_STATUSES.includes(c.status)
  )
  // 신청 기한: COALESCE(delivered_at, updated_at) + 7일 (043 이전 주문 delivered_at NULL 대비).
  const returnDeadline =
    new Date(order.delivered_at ?? order.updated_at).getTime() +
    RETURN_CONFIG.windowDays * 86_400_000
  const withinReturnWindow = Date.now() <= returnDeadline
  const canReturn =
    ["DELIVERED", "CONFIRMED"].includes(order.status) &&
    withinReturnWindow &&
    !activeClaim

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">주문 상세</h2>
          <p className="text-sm text-muted-foreground">{order.order_no}</p>
        </div>
        <Badge>{ORDER_STATUS_LABEL[order.status] || order.status}</Badge>
      </div>

      {/* 취소 사유 — status='CANCELLED'이고 메타데이터가 있을 때만 노출 */}
      {order.status === "CANCELLED" && order.cancellation_reason && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-1">
          <h3 className="font-medium text-sm">취소 사유</h3>
          <p className="text-sm">
            {buildCancellationLabel(
              order.cancellation_actor,
              order.cancellation_reason
            )}
          </p>
          {order.cancellation_note && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {order.cancellation_note}
            </p>
          )}
        </div>
      )}

      {/* 진행 중 반품/교환 신청 상태 + 철회(REQUESTED 한정) */}
      {activeClaim && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">
              {CLAIM_TYPE_LABEL[activeClaim.type]} 신청
            </h3>
            <Badge variant="secondary">
              {CLAIM_STATUS_LABEL[activeClaim.status]}
            </Badge>
          </div>
          {activeClaim.reason_detail && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {activeClaim.reason_detail}
            </p>
          )}
          {activeClaim.status === "REQUESTED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleWithdraw(activeClaim.id)}
              disabled={actionLoading}
            >
              신청 철회
            </Button>
          )}
        </div>
      )}

      {/* 상품 목록 */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-sm">주문 상품</h3>
        {order.items.map((item) => (
          <div key={item.id} className="py-2 border-t first:border-0">
            <div className="flex gap-3">
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
                <p className="text-sm">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.color}/{item.size} · {item.quantity}개
                </p>
                <p className="text-sm font-medium">
                  {(item.price * item.quantity).toLocaleString()}원
                </p>
              </div>
            </div>
            {order.status === "CONFIRMED" && (
              <div className="mt-2 flex justify-end">
                {item.is_reviewed ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Check size={14} strokeWidth={2} />
                    리뷰 작성 완료
                  </span>
                ) : (
                  <Link
                    href={`/mypage/reviews/write/${item.id}`}
                    className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition"
                  >
                    리뷰 작성
                  </Link>
                )}
              </div>
            )}
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
        {(order.courier || order.tracking_no) && (
          <div className="pt-2">
            <Separator className="mb-2" />
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                {order.courier && (
                  <>
                    <span className="text-muted-foreground">택배사:</span>{" "}
                    {order.courier}
                    <br />
                  </>
                )}
                {order.tracking_no && (
                  <>
                    <span className="text-muted-foreground">송장번호:</span>{" "}
                    {order.tracking_no}
                  </>
                )}
              </div>
              {(() => {
                const url = buildTrackingUrl(order.courier, order.tracking_no)
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      배송 조회
                    </Button>
                  </a>
                ) : null
              })()}
            </div>
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
            <Button
              variant="outline"
              onClick={() => setClaimDialogOpen(true)}
              disabled={actionLoading}
            >
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

      {/* 반품/교환 신청 Dialog */}
      <ClaimRequestDialog
        open={claimDialogOpen}
        onOpenChange={setClaimDialogOpen}
        orderId={order.id}
        orderShippingFee={order.shipping_fee}
        items={order.items}
        onSuccess={fetchOrder}
      />
    </div>
  )
}

export default OrderDetailPage
