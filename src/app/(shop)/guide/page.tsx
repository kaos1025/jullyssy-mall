import type { Metadata } from "next"
import { FAQ_ITEMS } from "@/constants/faq"
import { buildFaqPage } from "@/lib/seo/faq"

export const metadata: Metadata = {
  title: "이용안내 · 자주 묻는 질문",
  description:
    "쥴리씨 배송비·배송기간·교환·반품 정책 등 자주 묻는 질문을 안내합니다.",
  alternates: { canonical: "/guide" },
}

// 서버 컴포넌트 — FAQPage JSON-LD는 가시 콘텐츠(FAQ_ITEMS)와 동일 소스로 렌더한다
// (마크업·화면 1:1, Google 스팸정책 준수). 클라이언트 hydration 의존 없음.
const GuidePage = () => {
  const faqJsonLd = buildFaqPage(FAQ_ITEMS)

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <h1 className="text-2xl font-bold">이용안내</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        배송·교환·반품 관련 자주 묻는 질문입니다.
      </p>

      <dl className="mt-8 divide-y border-t">
        {FAQ_ITEMS.map((item) => (
          <div key={item.question} className="py-5">
            <dt className="flex gap-2 text-base font-semibold">
              <span className="text-primary">Q.</span>
              <span>{item.question}</span>
            </dt>
            <dd className="mt-2 pl-6 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default GuidePage
