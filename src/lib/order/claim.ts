// P1-16 반품/교환 claim 타입·라벨·차감액 SSOT (cancellation.ts 패턴 미러).
// migration 047 order_claims CHECK 제약과 1:1 정합. UI(어드민/마이페이지)도 이 파일에서 라벨 lookup.
import { RETURN_CONFIG } from "@/constants/shipping"

export type ClaimType = "RETURN" | "EXCHANGE"

export type ClaimStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "COLLECTED"
  | "REFUNDED"
  | "RESHIPPED"
  | "COMPLETED"
  | "WITHDRAWN"

export type ReasonCategory =
  | "CHANGE_OF_MIND"
  | "SIZE_MISMATCH"
  | "DEFECT"
  | "WRONG_ITEM"
  | "OTHER"

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  RETURN: "반품",
  EXCHANGE: "교환",
}

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  REQUESTED: "신청 접수",
  APPROVED: "승인",
  REJECTED: "거절",
  COLLECTED: "회수 완료",
  REFUNDED: "환불 완료",
  RESHIPPED: "재발송",
  COMPLETED: "교환 완료",
  WITHDRAWN: "철회",
}

export const REASON_CATEGORY_LABEL: Record<ReasonCategory, string> = {
  CHANGE_OF_MIND: "단순 변심",
  SIZE_MISMATCH: "사이즈 안 맞음",
  DEFECT: "상품 하자",
  WRONG_ITEM: "오배송",
  OTHER: "기타",
}

// 활성(비종결) claim status — 주문당 1건 제약(uniq_active_claim_per_order)과 정합.
export const ACTIVE_CLAIM_STATUSES: readonly ClaimStatus[] = [
  "REQUESTED",
  "APPROVED",
  "COLLECTED",
  "RESHIPPED",
] as const

// 판매자 귀책(차감 0) 사유 — 하자/오배송.
const ZERO_DEDUCTION_REASONS: readonly ReasonCategory[] = ["DEFECT", "WRONG_ITEM"]

// 차감액 제안 (서버 권위, 비구속). 운영자가 승인 시 confirmed_deduction으로 확정.
// 하자/오배송 = 0. 그 외(단순변심 등) = 초도 무료배송(shipping_fee 0) → 왕복 7,000 / 유료 → 편도 3,500.
// 초도 무료배송 판정 = orders.shipping_fee 0 여부 (Phase0 실측: 컬럼 존재 확인).
export const computeProposedDeduction = (
  reason: ReasonCategory,
  orderShippingFee: number
): number => {
  if (ZERO_DEDUCTION_REASONS.includes(reason)) return 0
  return orderShippingFee === 0
    ? RETURN_CONFIG.roundTripShippingFee
    : RETURN_CONFIG.returnShippingFee
}

// route 입력 검증용 타입 가드
export const isClaimType = (v: unknown): v is ClaimType =>
  v === "RETURN" || v === "EXCHANGE"

export const isReasonCategory = (v: unknown): v is ReasonCategory =>
  typeof v === "string" && v in REASON_CATEGORY_LABEL
