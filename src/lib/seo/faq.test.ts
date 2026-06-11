import { describe, it, expect } from "vitest"
import { buildFaqPage } from "./faq"
import { FAQ_ITEMS } from "@/constants/faq"

describe("buildFaqPage", () => {
  it("FAQPage 구조로 변환 (Question + acceptedAnswer)", () => {
    const jsonLd = buildFaqPage([
      { question: "Q1?", answer: "A1" },
      { question: "Q2?", answer: "A2" },
    ])
    expect(jsonLd["@context"]).toBe("https://schema.org")
    expect(jsonLd["@type"]).toBe("FAQPage")
    expect(jsonLd.mainEntity).toHaveLength(2)
    expect(jsonLd.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Q1?",
      acceptedAnswer: { "@type": "Answer", text: "A1" },
    })
  })

  it("빈 입력 → 빈 mainEntity", () => {
    expect(buildFaqPage([]).mainEntity).toHaveLength(0)
  })
})

describe("FAQ_ITEMS (정책 SSOT 정합)", () => {
  it("5~8개 Q&A, 모든 항목 question/answer 보유", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5)
    expect(FAQ_ITEMS.length).toBeLessThanOrEqual(8)
    for (const item of FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(0)
      expect(item.answer.length).toBeGreaterThan(0)
    }
  })

  it("교환·반품 왕복 배송비는 7,000원 (RETURN_CONFIG SSOT, stale 6,000 아님)", () => {
    const all = FAQ_ITEMS.map((i) => i.answer).join("\n")
    expect(all).toContain("7,000원")
    expect(all).not.toContain("6,000원")
  })

  it("교환·반품 배송비 답변은 편도/왕복 두 경우를 모두 명시", () => {
    const refundFeeAnswer = FAQ_ITEMS.find((i) =>
      i.question.includes("교환·반품 배송비"),
    )?.answer
    expect(refundFeeAnswer).toBeDefined()
    expect(refundFeeAnswer).toContain("편도")
    expect(refundFeeAnswer).toContain("왕복")
    expect(refundFeeAnswer).toContain("3,500원")
  })

  it("배송비/무료배송 정책 수치가 SHIPPING_CONFIG와 일치", () => {
    const all = FAQ_ITEMS.map((i) => i.answer).join("\n")
    expect(all).toContain("3,500원")
    expect(all).toContain("40,000원")
    expect(all).toContain("CJ대한통운")
  })
})
