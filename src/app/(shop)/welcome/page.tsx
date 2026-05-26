import Link from "next/link"
import { Gift, ShoppingBag, Sparkles, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "신규 가입 5,000원 쿠폰 | 쥴리씨",
  description:
    "쥴리씨 신규 회원에게 5,000원 할인 쿠폰을 드립니다. 카카오로 간편하게 시작하세요.",
  alternates: { canonical: "/welcome" },
  openGraph: {
    title: "신규 가입 5,000원 쿠폰 | 쥴리씨",
    description: "쥴리씨 신규 회원에게 5,000원 할인 쿠폰을 드립니다.",
    type: "website",
  },
  robots: { index: true, follow: true },
}

const WelcomePage = () => {
  return (
    <div>
      {/* Hero — 메인 카드 톤 연속(저채도 tint gradient) */}
      <section className="bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="container px-6 md:px-8 py-16 md:py-24">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-xs font-display tracking-[0.3em] text-muted-foreground mb-4">
              WELCOME OFFER
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
              신규 회원에게
              <br />
              5,000원 쿠폰을 드립니다
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-10">
              회원가입과 동시에 자동으로 발급됩니다
            </p>

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button
                asChild
                className="w-full h-12 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 font-medium"
              >
                <Link href="/login?redirect=/welcome">카카오로 시작하기</Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-12">
                <Link href="/signup">이메일로 회원가입</Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-6">
              이미 회원이신가요?{" "}
              <Link
                href="/login"
                className="text-foreground underline hover:no-underline"
              >
                로그인
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* 쿠폰 안내 */}
      <section className="py-16 md:py-20">
        <div className="container px-6 md:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-8 md:mb-10">
              쿠폰 안내
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <Card>
                <CardContent className="p-6 md:p-8 flex flex-col items-center text-center">
                  <Gift
                    className="h-8 w-8 text-primary mb-3"
                    strokeWidth={1.5}
                  />
                  <h3 className="font-semibold mb-2">5,000원 즉시 지급</h3>
                  <p className="text-sm text-muted-foreground">
                    가입 즉시 쿠폰함에서 확인하실 수 있습니다
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 md:p-8 flex flex-col items-center text-center">
                  <ShoppingBag
                    className="h-8 w-8 text-primary mb-3"
                    strokeWidth={1.5}
                  />
                  <h3 className="font-semibold mb-2">20,000원 이상 주문</h3>
                  <p className="text-sm text-muted-foreground">
                    최소 주문 금액 충족 시 사용 가능합니다
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 md:p-8 flex flex-col items-center text-center">
                  <Sparkles
                    className="h-8 w-8 text-primary mb-3"
                    strokeWidth={1.5}
                  />
                  <h3 className="font-semibold mb-2">사용 조건 안내</h3>
                  <p className="text-sm text-muted-foreground">
                    유효기간과 적용 조건은 쿠폰함에서 확인하세요
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-10 md:mt-12 text-center">
              <Link
                href="/products"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                먼저 상품 둘러보기
                <ArrowRight
                  className="h-4 w-4 ml-1"
                  strokeWidth={1.5}
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default WelcomePage
