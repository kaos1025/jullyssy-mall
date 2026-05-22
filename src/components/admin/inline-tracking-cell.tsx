"use client"

import { useState } from "react"
import { Check, ExternalLink, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { buildTrackingUrl } from "@/lib/order/tracking-url"

// 어드민 주문 그리드 셀 인라인 입력 — courier / tracking_no.
// blur 시 즉시 PATCH (debounce 없음). PATCH 핸들러는 P1-22 terminal freeze 적용 상태로,
// CANCELLED/DELIVERED는 호출돼도 409로 거부됨 — 본 컴포넌트는 그 전 단계에서 disabled로
// 사용자 진입 자체를 차단(defense-in-depth).
interface InlineTrackingCellProps {
  orderId: string
  field: "courier" | "tracking_no"
  initialValue: string | null
  disabled: boolean
  onSaved: (newValue: string) => void
  // 추적 URL은 송장번호 셀에만 노출 — courier 값과 함께 빌드해야 통합 검색이 정확
  courierForUrl?: string | null
}

export const InlineTrackingCell = ({
  orderId,
  field,
  initialValue,
  disabled,
  onSaved,
  courierForUrl,
}: InlineTrackingCellProps) => {
  const { toast } = useToast()
  const [draft, setDraft] = useState(initialValue ?? "")
  const [savedValue, setSavedValue] = useState(initialValue ?? "")
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const handleBlur = async () => {
    const trimmed = draft.trim()
    if (trimmed === savedValue) return

    setSaving(true)
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: trimmed || null }),
    })
    setSaving(false)

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }
      toast({
        variant: "destructive",
        title: "송장 저장 실패",
        description: err.message || err.error || "잠시 후 다시 시도해주세요",
      })
      setDraft(savedValue) // 입력값 롤백
      return
    }

    setSavedValue(trimmed)
    onSaved(trimmed)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  // 추적 링크는 송장번호 셀 + courier/tracking 모두 채워진 경우만 표시
  const url =
    field === "tracking_no"
      ? buildTrackingUrl(courierForUrl, savedValue || null)
      : null

  return (
    <div className="flex items-center gap-1">
      <Input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        disabled={disabled || saving}
        list={field === "courier" ? "courier-suggestions" : undefined}
        placeholder={field === "courier" ? "택배사" : "송장번호"}
        className="h-7 text-xs"
      />
      {saving && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
      )}
      {justSaved && !saving && (
        <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
      )}
      {url && !saving && !justSaved && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          title="네이버에서 송장 조회"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
