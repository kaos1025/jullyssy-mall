import type { OrderStatus } from "@/types"

// 마이페이지 주문 목록에 노출할 status 화이트리스트.
// PENDING은 결제 confirm 미진입 상태 — 사용자에게 노출하면 "결제 안 했는데 주문이 잡혀있다"는
// 혼란을 일으키고, 일정 시간 뒤 cron(033)에 의해 CANCELLED로 전이된다.
// 어드민 주문 목록은 운영 모니터링 가치가 있어 PENDING을 별도로 유지한다 (별 라우트).
//
// 블랙리스트 대신 화이트리스트를 쓰는 이유: 신규 status가 추가될 때 누락 노출을 막기 위함
// (Day 22 PR #17 status 화이트리스트 패턴).
export const VISIBLE_ORDER_STATUSES = [
  "PAID",
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
  "CONFIRMED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "EXCHANGE_REQUESTED",
  "EXCHANGED",
] as const satisfies readonly OrderStatus[]
