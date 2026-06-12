import { describe, it, expect } from "vitest"
import { computeProposedDeduction } from "./claim"

// G3: 교환 변심 차감은 초도 배송비와 무관하게 항상 왕복 7,000 (유료배송 교환이 편도 3,500으로
// 오산정되던 결함 회귀 고정). 반품은 초도 배송비 기준 유지.
describe("computeProposedDeduction (차감액 제안 SSOT)", () => {
  it("하자/오배송은 type·배송비 무관 0 (판매자 귀책)", () => {
    expect(computeProposedDeduction("RETURN", "DEFECT", 3500)).toBe(0)
    expect(computeProposedDeduction("RETURN", "DEFECT", 0)).toBe(0)
    expect(computeProposedDeduction("EXCHANGE", "WRONG_ITEM", 0)).toBe(0)
    expect(computeProposedDeduction("EXCHANGE", "WRONG_ITEM", 3500)).toBe(0)
  })

  it("교환 변심/사이즈는 초도 배송비 무관 항상 왕복 7,000", () => {
    expect(computeProposedDeduction("EXCHANGE", "CHANGE_OF_MIND", 0)).toBe(7000)
    // ⚠️ 핵심 회귀: 유료배송(3,500) 주문 교환도 7,000 (편도 3,500 아님)
    expect(computeProposedDeduction("EXCHANGE", "CHANGE_OF_MIND", 3500)).toBe(7000)
    expect(computeProposedDeduction("EXCHANGE", "SIZE_MISMATCH", 3500)).toBe(7000)
    expect(computeProposedDeduction("EXCHANGE", "OTHER", 3500)).toBe(7000)
  })

  it("반품 변심은 초도 무료배송이면 왕복 7,000, 유료면 편도 3,500", () => {
    expect(computeProposedDeduction("RETURN", "CHANGE_OF_MIND", 0)).toBe(7000)
    expect(computeProposedDeduction("RETURN", "CHANGE_OF_MIND", 3500)).toBe(3500)
    expect(computeProposedDeduction("RETURN", "SIZE_MISMATCH", 3500)).toBe(3500)
    expect(computeProposedDeduction("RETURN", "SIZE_MISMATCH", 0)).toBe(7000)
  })
})
