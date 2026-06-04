// 배송완료 주체 SSOT (수동 입력 vs 자동 폴링 구분).
// 서버 전용 의존성 없음 → markOrderDelivered(서버)와 어드민 페이지(client) 양쪽에서 안전하게 공유.
// orders.delivered_via 컬럼은 TEXT + CHECK('ADMIN'|'SYSTEM') (migration 043).

export type DeliveredVia = "ADMIN" | "SYSTEM"

// 어드민 배송완료 badge 라벨. cancellation actor 표기("· 판매자/· 시스템")와 같은 결의 짧은 보조 텍스트.
export const DELIVERED_VIA_LABEL: Record<DeliveredVia, string> = {
  ADMIN: "수동",
  SYSTEM: "자동",
}
