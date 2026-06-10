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

// =============================================
// 반품/교환 정책 (P1-16 spec v0.2 §1)
// =============================================
// SHIPPING_CONFIG와 별개 축: 위 jeju/remoteExtraFee(6,000, 도서산간 추가배송비)와 무관.
// 반품/교환 차감 배송비는 단순변심 시에만 부과(하자·오배송=0). 운영자 확정값 2026-06-10.
export const RETURN_CONFIG = {
  returnShippingFee: 3500, // 반품 편도 (초도 유료배송 주문 단순변심)
  roundTripShippingFee: 7000, // 왕복 (초도 무료배송 주문 단순변심 / 교환 단순변심)
  pickupAddress:
    "서울특별시 중구 장충단로13길 20 (현대시티타워) 12층 B-10/1,3호",
  windowDays: 7, // 신청 기한 — COALESCE(delivered_at, updated_at) 기준
} as const
