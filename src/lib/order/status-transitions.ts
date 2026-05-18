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
] as const

// bulk 변경은 운영 실수의 영향이 N배라 더 좁게 — 배송 운영 흐름만 허용.
export const ADMIN_ORDER_STATUS_BULK_ALLOWED = [
  "PREPARING",
  "SHIPPING",
] as const

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
