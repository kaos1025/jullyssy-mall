import type { OrderStatus } from "@/types"

// 어드민이 PATCH 라우트에서 직접 설정 가능한 orders.status 화이트리스트 — 배송 운영 흐름만.
//
// 제외 이유:
// - PENDING/PAID: 결제 라이프사이클은 confirm/webhook으로만 전이되어야 한다
// - CONFIRMED: 사용자 "구매확정" 라우트 전용
// - CANCELLED: cancelOrder() 전용 (토스 환불 + 재고/포인트/쿠폰 원복 동반)
// - RETURN_REQUESTED/RETURNED/EXCHANGE_REQUESTED/EXCHANGED: 결제 환불을 동반해야 하는데
//   현재 코드 경로는 status만 update하면서 cancelOrder를 우회하는 동일 결함 패턴.
//   반품/교환 플로우는 별도 P1 후속과제로 분리. status만 바꾸는 진입로는 닫는다.
export const ADMIN_ORDER_STATUS_ALLOWED = [
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
] as const satisfies readonly OrderStatus[]

// bulk 변경은 운영 실수의 영향이 N배라 더 좁게 — 배송 운영 흐름만 허용.
export const ADMIN_ORDER_STATUS_BULK_ALLOWED = [
  "PREPARING",
  "SHIPPING",
] as const satisfies readonly OrderStatus[]

// 어드민 단건 주문 상태 변경 dropdown에 노출할 옵션.
// ADMIN_ORDER_STATUS_ALLOWED(PATCH 화이트리스트) + CANCELLED(cancelOrder 전용 분기)와 정합.
// 라벨은 ORDER_STATUS_LABEL에서 lookup(SSOT 단일화). 화이트리스트 외 옵션을 UI에 노출하면
// 운영자가 선택 후 백엔드 400을 받는 운영 차단 회귀가 발생하므로 한 곳에서 관리.
// CONFIRMED/RETURN_*/EXCHANGE_*는 본 hotfix 시점에 의도적으로 제외 — 정식 반품/교환 플로우는 후속 P1.
export const ADMIN_ORDER_STATUS_OPTIONS = [
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[]

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUS_ALLOWED)[number]
export type AdminOrderBulkStatus = (typeof ADMIN_ORDER_STATUS_BULK_ALLOWED)[number]

export const isAdminOrderStatusAllowed = (
  status: unknown
): status is AdminOrderStatus =>
  typeof status === "string" &&
  (ADMIN_ORDER_STATUS_ALLOWED as readonly string[]).includes(status)

export const isAdminOrderStatusBulkAllowed = (
  status: unknown
): status is AdminOrderBulkStatus =>
  typeof status === "string" &&
  (ADMIN_ORDER_STATUS_BULK_ALLOWED as readonly string[]).includes(status)

// Terminal status — 도달 후 어떤 status로도 전이 금지.
// CANCELLED: 환불/원복 동반된 종결, 재활성화 시 회계 불일치 + cancellation_actor 메타 inconsistency
// DELIVERED: 배송 완료된 거래 종결, 재활성화 시 운영 흐름 역행
// (반품/교환 플로우는 별도 RETURN_REQUESTED/EXCHANGE_REQUESTED status로 분기 — 본 freeze는 PATCH의
// 자유 전이만 차단하며, 향후 정식 반품/교환 라우트는 별도 진입로로 구현)
export const TERMINAL_ORDER_STATUSES = ["CANCELLED", "DELIVERED"] as const

export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number]

export const isTerminalOrderStatus = (
  status: unknown
): status is TerminalOrderStatus =>
  typeof status === "string" &&
  (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status)

// =============================================
// P1-16: claim(반품/교환) 구동 orders.status 전이
// =============================================
// 어드민 직접 전이(ADMIN_ORDER_STATUS_ALLOWED)와 분리 — 반품/교환 4종 status는
// claim 함수/오케스트레이션 경유로만 설정(status만 바꾸는 PATCH 진입로는 여전히 닫힘).
// 거절/철회 시 orders.status는 claim.prev_order_status로 원복(오케스트레이션 책임).
export type ClaimType = "RETURN" | "EXCHANGE"

// claim 이벤트 → orders.status 매핑 (SSOT, vitest 대상)
export const CLAIM_DRIVEN_TRANSITIONS = {
  RETURN: { requested: "RETURN_REQUESTED", terminal: "RETURNED" },
  EXCHANGE: { requested: "EXCHANGE_REQUESTED", terminal: "EXCHANGED" },
} as const satisfies Record<
  ClaimType,
  { requested: OrderStatus; terminal: OrderStatus }
>

// claim 신청(REQUESTED) 시 진입할 orders.status
export const claimRequestedOrderStatus = (type: ClaimType): OrderStatus =>
  CLAIM_DRIVEN_TRANSITIONS[type].requested

// claim 종결(환불완료 REFUNDED / 교환완료 COMPLETED) orders.status (terminal)
export const claimTerminalOrderStatus = (type: ClaimType): OrderStatus =>
  CLAIM_DRIVEN_TRANSITIONS[type].terminal
