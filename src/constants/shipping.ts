export const SHIPPING_CONFIG = {
  baseFee: 3500,              // 기본 배송비
  freeShippingThreshold: 40000, // 무료배송 기준금액
  jejuExtraFee: 6000,          // 제주 추가배송비
  remoteExtraFee: 6000,        // 도서산간 추가배송비
  courier: "CJ대한통운",        // 배송업체
  estimatedDays: "1~3 영업일",  // 예상 배송기간
} as const

/** 배송비 계산 함수 */
export function calculateShippingFee(
  totalPrice: number,
  options?: { hasFreeShippingItem?: boolean },
): number {
  if (totalPrice <= 0) return 0

  // 무료배송 상품이 포함되면 전체 주문 무료배송
  if (options?.hasFreeShippingItem) return 0

  return totalPrice >= SHIPPING_CONFIG.freeShippingThreshold
    ? 0
    : SHIPPING_CONFIG.baseFee
}

// 하위 호환용 re-export
export const SHIPPING_FEE = SHIPPING_CONFIG.baseFee
export const FREE_SHIPPING_THRESHOLD = SHIPPING_CONFIG.freeShippingThreshold
