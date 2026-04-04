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
  // TODO: P2 - 제주/도서산간 추가배송비 (주소 기반 판별 로직 필요)
  // isJeju?: boolean,
  // isRemote?: boolean,
): number {
  if (totalPrice <= 0) return 0

  const fee =
    totalPrice >= SHIPPING_CONFIG.freeShippingThreshold
      ? 0
      : SHIPPING_CONFIG.baseFee

  // TODO: P2 - 제주/도서산간 추가배송비 활성화 시 let으로 변경
  // if (isJeju) fee += SHIPPING_CONFIG.jejuExtraFee
  // if (isRemote) fee += SHIPPING_CONFIG.remoteExtraFee

  return fee
}

// 하위 호환용 re-export
export const SHIPPING_FEE = SHIPPING_CONFIG.baseFee
export const FREE_SHIPPING_THRESHOLD = SHIPPING_CONFIG.freeShippingThreshold
