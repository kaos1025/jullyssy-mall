// 배송·교환·반품 FAQ SSOT (SEO-SCHEMA-BUNDLE-1 Phase 2).
//
// 정책 수치는 실제 코드 SSOT에서 보간한다 (추측 정책 금지, drift 차단):
//   - 배송비/무료배송/택배사/배송기간 → SHIPPING_CONFIG
//   - 교환·반품 기한/왕복 배송비 → RETURN_CONFIG (운영자 확정 2026-06-10, 왕복 7,000원)
//   - 고객센터 운영시간 → BUSINESS_INFO
// /guide 페이지가 본 배열을 화면에 렌더하고 buildFaqPage로 FAQPage JSON-LD를 생성한다
// (마크업·화면 1:1 일치 — Google 스팸정책 준수).

import { SHIPPING_CONFIG, RETURN_CONFIG } from "./shipping"
import { BUSINESS_INFO } from "./business"
import type { FaqItem } from "@/lib/seo/faq"

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "배송비는 얼마인가요?",
    answer: `기본 배송비는 ${SHIPPING_CONFIG.baseFee.toLocaleString()}원이며, ${SHIPPING_CONFIG.freeShippingThreshold.toLocaleString()}원 이상 구매 시 무료배송입니다. 제주 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.`,
  },
  {
    question: "배송은 얼마나 걸리나요?",
    answer: `결제 완료 후 ${SHIPPING_CONFIG.estimatedDays} 이내에 출고되며, 택배사는 ${SHIPPING_CONFIG.courier}입니다.`,
  },
  {
    question: "교환·반품은 언제까지 신청할 수 있나요?",
    answer: `상품 수령 후 ${RETURN_CONFIG.windowDays}일 이내에 마이페이지 주문내역에서 신청하실 수 있습니다.`,
  },
  {
    question: "교환·반품 배송비는 어떻게 되나요?",
    answer: `단순 변심에 의한 반품 배송비는 주문의 배송 조건에 따라 다릅니다. 유료배송 주문의 반품은 반송 편도 ${RETURN_CONFIG.returnShippingFee.toLocaleString()}원, 무료배송 주문의 반품은 왕복 ${RETURN_CONFIG.roundTripShippingFee.toLocaleString()}원이 부과됩니다. 교환(단순 변심)은 왕복 ${RETURN_CONFIG.roundTripShippingFee.toLocaleString()}원이며, 상품 불량이나 오배송의 경우 배송비는 무료입니다.`,
  },
  {
    question: "교환·반품이 불가능한 경우도 있나요?",
    answer:
      "착용 흔적이 있거나 택(tag)을 제거한 상품, 세탁한 상품은 교환·반품이 불가합니다. 상품 가치가 훼손된 경우에도 제한될 수 있습니다.",
  },
  {
    question: "주문을 취소하고 싶어요.",
    answer:
      "결제 완료 후 상품 준비 전까지는 주문내역에서 취소하실 수 있습니다. 상품 준비중 단계 이후에는 취소가 불가하며, 교환·반품 절차로 진행됩니다.",
  },
  {
    question: "문의는 어디로 하면 되나요?",
    answer: `카카오톡 채널 또는 고객센터로 문의해 주세요. 운영시간은 ${BUSINESS_INFO.customerCenter.hours}이며, ${BUSINESS_INFO.customerCenter.lunch}은 제외됩니다.`,
  },
]
