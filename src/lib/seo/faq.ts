// FAQPage JSON-LD 빌더 (SEO-SCHEMA-BUNDLE-1 Phase 2).
//
// ⚠️ Google 스팸정책: FAQPage 마크업은 페이지에 실제 렌더되는 가시 콘텐츠와 일치해야 한다.
// → /guide 페이지가 동일한 FAQ_ITEMS(constants/faq.ts)를 화면에 렌더하고 본 빌더로 JSON-LD를
//   생성한다 (단일 소스 → 마크업·화면 1:1 보장).

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqPageJsonLd {
  "@context": "https://schema.org"
  "@type": "FAQPage"
  mainEntity: Array<{
    "@type": "Question"
    name: string
    acceptedAnswer: {
      "@type": "Answer"
      text: string
    }
  }>
}

export const buildFaqPage = (items: FaqItem[]): FaqPageJsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
})
