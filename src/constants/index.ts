export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "주문대기",
  PAID: "결제완료",
  PREPARING: "상품준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CONFIRMED: "구매확정",
  CANCELLED: "취소완료",
  RETURN_REQUESTED: "반품신청",
  RETURNED: "반품완료",
  EXCHANGE_REQUESTED: "교환신청",
  EXCHANGED: "교환완료",
}

export const SHIPPING_FEE = 3000
export const FREE_SHIPPING_THRESHOLD = 50000

export const SORT_OPTIONS = [
  { value: "newest", label: "신상품순" },
  { value: "price_asc", label: "가격낮은순" },
  { value: "price_desc", label: "가격높은순" },
  { value: "popular", label: "인기순" },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]["value"]
