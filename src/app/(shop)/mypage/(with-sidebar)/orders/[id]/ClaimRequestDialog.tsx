"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  CLAIM_TYPE_LABEL,
  REASON_CATEGORY_LABEL,
  computeProposedDeduction,
  type ClaimType,
  type ReasonCategory,
} from "@/lib/order/claim"
import { createClient } from "@/lib/supabase/client"
import {
  DEPOSIT_ACCOUNT,
  DEPOSIT_ACCOUNT_CONFIGURED,
} from "@/constants/shipping"

interface ProductOptionRow {
  id: string
  color: string
  size: string
  extra_price: number
  stock: number
}

interface ClaimRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  orderShippingFee: number
  items: { id: string; product_id: string | null; product_option_id: string | null; product_name: string; color: string; size: string; quantity: number }[]
  onSuccess: () => void
}

const ClaimRequestDialog = ({
  open,
  onOpenChange,
  orderId,
  orderShippingFee,
  items,
  onSuccess,
}: ClaimRequestDialogProps) => {
  const { toast } = useToast()
  const canExchange = items.length === 1

  const [type, setType] = useState<ClaimType>("RETURN")
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | "">("")
  const [reasonDetail, setReasonDetail] = useState("")
  const [exchangeToOptionId, setExchangeToOptionId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // exchange option fetch state
  const [optionsFetched, setOptionsFetched] = useState(false)
  const [candidateOptions, setCandidateOptions] = useState<ProductOptionRow[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setType("RETURN")
      setReasonCategory("")
      setReasonDetail("")
      setExchangeToOptionId("")
      setOptionsFetched(false)
      setCandidateOptions([])
    }
  }, [open])

  // Fetch exchange options when type switches to EXCHANGE
  useEffect(() => {
    if (type !== "EXCHANGE" || optionsFetched) return
    const productId = items[0]?.product_id
    const sourceOptionId = items[0]?.product_option_id
    const sourceQuantity = items[0]?.quantity ?? 1
    if (!productId || !sourceOptionId) {
      setOptionsFetched(true)
      return
    }

    const fetchOptions = async () => {
      setOptionsLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("product_options")
        .select("id, color, size, extra_price, stock")
        .eq("product_id", productId)

      if (error || !data) {
        setOptionsLoading(false)
        setOptionsFetched(true)
        return
      }

      const rows = data as ProductOptionRow[]
      const source = rows.find((r) => r.id === sourceOptionId)
      const candidates = source
        ? rows.filter(
            (r) =>
              r.extra_price === source.extra_price &&
              r.stock >= sourceQuantity &&
              r.id !== source.id
          )
        : []

      setCandidateOptions(candidates)
      setOptionsLoading(false)
      setOptionsFetched(true)
    }

    fetchOptions()
  }, [type, optionsFetched, items])

  const proposedDeduction =
    reasonCategory !== ""
      ? computeProposedDeduction(type, reasonCategory, orderShippingFee)
      : null

  const handleSubmit = async () => {
    if (!reasonCategory) {
      toast({ variant: "destructive", title: "사유를 선택해주세요" })
      return
    }
    if (type === "EXCHANGE" && !exchangeToOptionId) {
      toast({ variant: "destructive", title: "교환할 옵션을 선택해주세요" })
      return
    }

    const body: Record<string, unknown> = {
      type,
      reasonCategory,
      reasonDetail: reasonDetail.trim() || null,
    }
    if (type === "EXCHANGE") {
      body.exchangeToOptionId = exchangeToOptionId
    }

    setSubmitting(true)
    const res = await fetch(`/api/orders/${orderId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSubmitting(false)

    if (res.ok) {
      toast({ title: "신청이 접수되었습니다" })
      onSuccess()
      onOpenChange(false)
    } else {
      const err = await res.json().catch(() => ({}))
      toast({
        variant: "destructive",
        title: "신청 실패",
        description: (err as { error?: string }).error || "요청을 처리하지 못했습니다",
      })
    }
  }

  const noExchangeOptions = type === "EXCHANGE" && optionsFetched && candidateOptions.length === 0
  const submitDisabled =
    submitting ||
    !reasonCategory ||
    (type === "EXCHANGE" && (!exchangeToOptionId || noExchangeOptions))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>반품/교환 신청</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 신청유형 */}
          <div className="space-y-1">
            <label className="text-sm font-medium">신청유형</label>
            <Select
              value={type}
              onValueChange={(v) => {
                const next = v as ClaimType
                setType(next)
                setExchangeToOptionId("")
                // EXCHANGE 재선택 시 옵션 재조회 강제(세션 내 stale 방지)
                if (next === "EXCHANGE") setOptionsFetched(false)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RETURN">{CLAIM_TYPE_LABEL.RETURN}</SelectItem>
                {canExchange && (
                  <SelectItem value="EXCHANGE">{CLAIM_TYPE_LABEL.EXCHANGE}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 사유 */}
          <div className="space-y-1">
            <label className="text-sm font-medium">사유 <span className="text-destructive">*</span></label>
            <Select
              value={reasonCategory}
              onValueChange={(v) => setReasonCategory(v as ReasonCategory)}
            >
              <SelectTrigger>
                <SelectValue placeholder="사유를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(REASON_CATEGORY_LABEL) as [ReasonCategory, string][]).map(
                  ([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 상세사유 */}
          <div className="space-y-1">
            <label className="text-sm font-medium">상세사유 (선택)</label>
            <textarea
              value={reasonDetail}
              onChange={(e) => setReasonDetail(e.target.value)}
              rows={3}
              placeholder="구체적인 사유를 입력하시면 빠른 처리에 도움이 됩니다"
              className="w-full px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* 교환 옵션 (EXCHANGE only) */}
          {type === "EXCHANGE" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">교환 옵션 <span className="text-destructive">*</span></label>
              {optionsLoading ? (
                <p className="text-sm text-muted-foreground">옵션 불러오는 중...</p>
              ) : noExchangeOptions ? (
                <p className="text-sm text-destructive">교환 가능한 옵션이 없습니다</p>
              ) : (
                <Select value={exchangeToOptionId} onValueChange={setExchangeToOptionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="교환할 옵션을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.color}/{opt.size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* 예상 차감액 / 교환 입금 안내 */}
          {proposedDeduction !== null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
              {type === "EXCHANGE" && proposedDeduction > 0 ? (
                <>
                  <p>
                    교환 왕복 배송비:{" "}
                    <span className="font-semibold">
                      {proposedDeduction.toLocaleString()}원
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    교환은 환불이 없어 배송비를 무통장 입금으로 안내드립니다.
                  </p>
                  {DEPOSIT_ACCOUNT_CONFIGURED ? (
                    <p className="text-xs">
                      {DEPOSIT_ACCOUNT.bank} {DEPOSIT_ACCOUNT.accountNumber} (예금주{" "}
                      {DEPOSIT_ACCOUNT.holder})
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      입금 계좌는 승인 후 별도로 안내드립니다.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ※ 운영자 승인 후 확정·안내되며, 입금 확인 후 재발송됩니다.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    예상 차감 배송비:{" "}
                    <span className="font-semibold">
                      {proposedDeduction.toLocaleString()}원
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ※ 운영자 승인 시 확정되며 변동될 수 있습니다.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            닫기
          </Button>
          <Button onClick={handleSubmit} disabled={submitDisabled}>
            {submitting ? "신청 중..." : "신청하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ClaimRequestDialog
