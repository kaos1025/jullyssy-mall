"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  CLAIM_TYPE_LABEL,
  CLAIM_STATUS_LABEL,
  REASON_CATEGORY_LABEL,
  type ClaimType,
  type ClaimStatus,
  type ReasonCategory,
} from "@/lib/order/claim"
import { COURIER_SUGGESTIONS } from "@/lib/order/courier-suggestions"
import dayjs from "dayjs"

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "REQUESTED", label: "신청접수" },
  { value: "APPROVED", label: "승인" },
  { value: "COLLECTED", label: "회수완료" },
  { value: "RESHIPPED", label: "재발송" },
]

interface ClaimOrder {
  order_no: string
  recipient: string
  paid_amount: number
}

interface ClaimRow {
  id: string
  order_id: string
  type: ClaimType
  status: ClaimStatus
  reason_category: ReasonCategory
  reason_detail: string | null
  proposed_deduction: number
  confirmed_deduction: number | null
  refund_amount: number | null
  exchange_to_option_id: string | null
  reship_tracking_number: string | null
  reship_courier: string | null
  rejected_reason: string | null
  requested_at: string
  created_at: string
  orders: ClaimOrder | null
}

type ActionType =
  | "approve"
  | "reject"
  | "collect"
  | "refund"
  | "reship"
  | "complete"

interface ActionTarget {
  claim: ClaimRow
  action: ActionType
}

const AdminClaimsPage = () => {
  const { toast } = useToast()
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [loading, setLoading] = useState(true)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // approve dialog state
  const [confirmedDeduction, setConfirmedDeduction] = useState("")
  // reject dialog state
  const [rejectReason, setRejectReason] = useState("")
  // reship dialog state
  const [reshipCourier, setReshipCourier] = useState("")
  const [reshipTracking, setReshipTracking] = useState("")

  const fetchClaims = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    const res = await fetch(`/api/admin/claims?${params}`)
    const data = await res.json()
    if (data.error) {
      setClaims([])
      toast({
        variant: "destructive",
        title: "목록을 불러오지 못했습니다",
        description: data.error,
      })
    } else {
      setClaims(data)
    }
    setLoading(false)
  }, [statusFilter, toast])

  useEffect(() => {
    fetchClaims()
  }, [fetchClaims])

  const openAction = (claim: ClaimRow, action: ActionType) => {
    // 모든 다이얼로그 필드 초기화 후 액션별 기본값 — row/action 전환 시 잔존 상태 방지.
    // setActionTarget를 마지막에 호출해 초기화 전 상태로 1프레임 렌더되는 flash 제거.
    setConfirmedDeduction(
      action === "approve" ? String(claim.proposed_deduction) : ""
    )
    setRejectReason("")
    setReshipCourier("")
    setReshipTracking("")
    setActionTarget({ claim, action })
  }

  const closeDialog = () => setActionTarget(null)

  const handleSubmit = async () => {
    if (!actionTarget) return
    const { claim, action } = actionTarget

    let body: Record<string, unknown> | undefined
    if (action === "approve") {
      const deduction = Number(confirmedDeduction)
      if (!Number.isInteger(deduction) || deduction < 0) {
        toast({
          variant: "destructive",
          title: "차감액은 0 이상 정수로 입력하세요",
        })
        return
      }
      body = { confirmedDeduction: deduction }
    }
    if (action === "reject") {
      if (!rejectReason.trim()) {
        toast({ variant: "destructive", title: "거절 사유를 입력하세요" })
        return
      }
      body = { reason: rejectReason.trim() }
    }
    if (action === "reship") {
      if (!reshipCourier.trim() || !reshipTracking.trim()) {
        toast({ variant: "destructive", title: "택배사와 송장번호를 모두 입력하세요" })
        return
      }
      body = { tracking: reshipTracking.trim(), courier: reshipCourier.trim() }
    }

    setSubmitting(true)
    const res = await fetch(`/api/admin/claims/${claim.id}/${action}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    setSubmitting(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "처리 실패",
        description: (err as { error?: string }).error || "요청을 처리하지 못했습니다",
      })
      return
    }

    closeDialog()
    fetchClaims()
    toast({ title: "처리 완료" })
  }

  const refundPreview = (claim: ClaimRow): number => {
    const deduction = claim.confirmed_deduction ?? claim.proposed_deduction
    return Math.max(0, (claim.orders?.paid_amount ?? 0) - deduction)
  }

  const renderActions = (claim: ClaimRow) => {
    const { status, type } = claim
    if (status === "REQUESTED") {
      return (
        <div className="flex gap-1">
          <Button size="sm" variant="default" onClick={() => openAction(claim, "approve")}>
            승인
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAction(claim, "reject")}>
            거절
          </Button>
        </div>
      )
    }
    if (status === "APPROVED") {
      return (
        <Button size="sm" variant="outline" onClick={() => openAction(claim, "collect")}>
          회수완료
        </Button>
      )
    }
    if (status === "COLLECTED" && type === "RETURN") {
      return (
        <Button size="sm" variant="default" onClick={() => openAction(claim, "refund")}>
          환불 실행
        </Button>
      )
    }
    if (status === "COLLECTED" && type === "EXCHANGE") {
      return (
        <Button size="sm" variant="outline" onClick={() => openAction(claim, "reship")}>
          재발송
        </Button>
      )
    }
    if (status === "RESHIPPED") {
      return (
        <Button size="sm" variant="outline" onClick={() => openAction(claim, "complete")}>
          교환완료
        </Button>
      )
    }
    return null
  }

  const dialogTitle = (): string => {
    if (!actionTarget) return ""
    const map: Record<ActionType, string> = {
      approve: "반품/교환 승인",
      reject: "반품/교환 거절",
      collect: "회수완료 처리",
      refund: "환불 실행",
      reship: "재발송 처리",
      complete: "교환완료 처리",
    }
    return map[actionTarget.action]
  }

  const renderDialogBody = () => {
    if (!actionTarget) return null
    const { claim, action } = actionTarget

    if (action === "approve") {
      return (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">차감 배송비(원)</label>
            <Input
              type="number"
              min={0}
              value={confirmedDeduction}
              onChange={(e) => setConfirmedDeduction(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              환불액 = 결제액 − 차감액
            </p>
          </div>
        </div>
      )
    }

    if (action === "reject") {
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium">거절 사유 (필수)</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="고객에게 안내할 거절 사유를 입력하세요"
            className="w-full mt-1 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )
    }

    if (action === "collect") {
      return (
        <p className="text-sm text-muted-foreground">
          회수 완료 처리하시겠습니까?
        </p>
      )
    }

    if (action === "refund") {
      return (
        <p className="text-sm">
          환불 예정액:{" "}
          <span className="font-semibold">
            {refundPreview(claim).toLocaleString()}원
          </span>
        </p>
      )
    }

    if (action === "reship") {
      return (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">택배사</label>
            <Input
              list="courier-suggestions"
              value={reshipCourier}
              onChange={(e) => setReshipCourier(e.target.value)}
              placeholder="택배사 입력"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">송장번호</label>
            <Input
              value={reshipTracking}
              onChange={(e) => setReshipTracking(e.target.value)}
              placeholder="송장번호 입력"
              className="mt-1"
            />
          </div>
        </div>
      )
    }

    if (action === "complete") {
      return (
        <p className="text-sm text-muted-foreground">
          교환완료 처리하시겠습니까?
        </p>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      {/* 재발송 택배사 datalist (전 row 공유) */}
      <datalist id="courier-suggestions">
        {COURIER_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">반품/교환 관리</h1>
      </div>

      {/* 상태 탭 */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs md:text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 액션 다이얼로그 */}
      <Dialog open={actionTarget !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle()}</DialogTitle>
          </DialogHeader>
          <div className="py-2">{renderDialogBody()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "처리 중..." : "확인"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">신청유형</th>
              <th className="p-3 text-left">상태</th>
              <th className="p-3 text-left">주문번호</th>
              <th className="p-3 text-left">신청자</th>
              <th className="p-3 text-left">사유</th>
              <th className="p-3 text-left hidden md:table-cell">신청일</th>
              <th className="p-3 text-left">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : claims.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  신청 내역이 없습니다.
                </td>
              </tr>
            ) : (
              claims.map((claim) => (
                <tr key={claim.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <Badge variant={claim.type === "RETURN" ? "secondary" : "default"}>
                      {CLAIM_TYPE_LABEL[claim.type]}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {CLAIM_STATUS_LABEL[claim.status]}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {claim.orders?.order_no ?? "-"}
                  </td>
                  <td className="p-3">
                    {claim.orders?.recipient ?? "-"}
                  </td>
                  <td className="p-3 max-w-[200px]">
                    <p className="text-xs">
                      {REASON_CATEGORY_LABEL[claim.reason_category]}
                    </p>
                    {claim.reason_detail && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {claim.reason_detail}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                    {dayjs(claim.requested_at).format("MM/DD HH:mm")}
                  </td>
                  <td className="p-3">{renderActions(claim)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminClaimsPage
