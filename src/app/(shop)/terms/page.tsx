import { Metadata } from "next"
import { TERMS_OF_SERVICE } from "@/constants/terms"

export const generateMetadata = (): Metadata => ({
  title: "이용약관",
  description: "쥴리씨 이용약관",
  robots: { index: false },
})

const TermsPage = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">이용약관</h1>
      <p className="text-sm text-muted-foreground mb-8">
        시행일: 2026년 4월 1일
      </p>

      {TERMS_OF_SERVICE.map((article) => (
        <section key={article.title}>
          <h2 className="font-bold text-lg mt-8 mb-2">{article.title}</h2>

          {article.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              {article.description}
            </p>
          )}

          {article.items && (
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground leading-relaxed">
              {article.items.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  )
}

export default TermsPage
