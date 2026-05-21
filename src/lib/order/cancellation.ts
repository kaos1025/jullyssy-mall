// 주문 취소 actor/reason 메타데이터 SSOT.
// migration 035에서 orders.cancellation_actor / cancellation_reason / cancellation_note 컬럼 추가.
// TEXT + CHECK constraint이라 Supabase 자동 생성 타입은 string으로만 인식 — 이 파일에서 union literal로 강제.

export type CancellationActor = "USER" | "ADMIN" | "SYSTEM"

export type CancellationReason =
  | "CUSTOMER_REQUEST"
  | "OUT_OF_STOCK"
  | "ORDER_ERROR"
  | "AUTO_EXPIRED"
  | "PAYMENT_FAILURE"
  | "OTHER"

export interface CancellationContext {
  actor: CancellationActor
  reason: CancellationReason
  note?: string | null
}

// 사유 단독 라벨 (어드민 모달 사유 드롭다운)
export const CANCELLATION_REASON_LABEL: Record<CancellationReason, string> = {
  CUSTOMER_REQUEST: "고객 요청",
  OUT_OF_STOCK: "품절",
  ORDER_ERROR: "주문 정보 오류",
  AUTO_EXPIRED: "자동 만료",
  PAYMENT_FAILURE: "결제 실패",
  OTHER: "기타",
}

// 어드민이 직접 선택 가능한 사유 (CUSTOMER_REQUEST는 사용자 요청 경로 전용 — 어드민 모달에서 제외)
export const ADMIN_CANCEL_REASONS = [
  "OUT_OF_STOCK",
  "ORDER_ERROR",
  "OTHER",
] as const satisfies readonly CancellationReason[]

export type AdminCancelReason = (typeof ADMIN_CANCEL_REASONS)[number]

export const isAdminCancelReason = (value: unknown): value is AdminCancelReason =>
  typeof value === "string" &&
  (ADMIN_CANCEL_REASONS as readonly string[]).includes(value)

// 사용자 마이페이지 주문 상세에 노출할 actor+reason 조합 라벨.
// "판매자 취소 — 품절" 식으로 사용자 멘탈 모델에 맞춰 prefix를 붙인다.
export const buildCancellationLabel = (
  actor: CancellationActor | null,
  reason: CancellationReason | null
): string => {
  if (!reason) return "취소완료"

  switch (actor) {
    case "USER":
      return reason === "CUSTOMER_REQUEST"
        ? "고객 요청 취소"
        : `고객 취소 — ${CANCELLATION_REASON_LABEL[reason]}`
    case "ADMIN":
      return `판매자 취소 — ${CANCELLATION_REASON_LABEL[reason]}`
    case "SYSTEM":
      if (reason === "AUTO_EXPIRED") return "결제 미완료 자동 취소"
      if (reason === "PAYMENT_FAILURE") return "결제 실패로 취소"
      return `시스템 취소 — ${CANCELLATION_REASON_LABEL[reason]}`
    default:
      return CANCELLATION_REASON_LABEL[reason]
  }
}
