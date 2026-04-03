"use client"

import { useState } from "react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { ChevronDown, Camera, MessageCircle } from "lucide-react"

const Footer = () => {
  const [showBizInfo, setShowBizInfo] = useState(false)

  return (
    <footer className="bg-warm pb-24 md:pb-0">
      <div className="container py-10 md:py-14">
        {/* PC: 4열 그리드 / 모바일: 1열 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
          {/* 브랜드 */}
          <div>
            <Link href="/" className="inline-block">
              <span className="font-display text-xl tracking-wider text-primary">
                쥴리씨
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              화면 너머의 여러분에게
              <br className="hidden md:block" />
              {" "}따뜻한 쇼핑메이트
            </p>
            {/* SNS */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href="#"
                aria-label="Instagram"
                className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Camera className="h-4 w-4" strokeWidth={1.5} />
              </a>
              <a
                href="#"
                aria-label="KakaoTalk"
                className="h-9 w-9 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          <Separator className="md:hidden" />

          {/* 고객센터 */}
          <div>
            <h4 className="text-sm font-semibold mb-3">고객센터</h4>
            <p className="text-2xl font-bold tracking-tight">1234-5678</p>
            <p className="text-sm text-muted-foreground mt-1">
              평일 10:00 - 17:00
            </p>
            <p className="text-sm text-muted-foreground">
              점심 12:00 - 13:00 / 주말·공휴일 휴무
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-full text-xs gap-1.5"
              asChild
            >
              <a href="#">
                <MessageCircle className="h-3.5 w-3.5" />
                카카오톡 문의하기
              </a>
            </Button>
          </div>

          <Separator className="md:hidden" />

          {/* 이용안내 */}
          <div>
            <h4 className="text-sm font-semibold mb-3">이용안내</h4>
            <nav aria-label="이용안내" className="flex flex-col gap-2">
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                이용약관
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                개인정보처리방침
              </Link>
              <Link
                href="/guide"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                이용안내
              </Link>
            </nav>
          </div>

          <Separator className="md:hidden" />

          {/* ABOUT — PC: 항상 표시, 모바일: 접기/펼치기 */}
          <div>
            {/* 모바일 토글 */}
            <button
              onClick={() => setShowBizInfo(!showBizInfo)}
              className="flex items-center justify-between w-full md:pointer-events-none"
            >
              <h4 className="text-sm font-semibold">ABOUT</h4>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground md:hidden transition-transform ${
                  showBizInfo ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`text-xs text-muted-foreground leading-relaxed mt-3 space-y-0.5 md:block ${
                showBizInfo ? "block" : "hidden"
              }`}
            >
              <p>상호: 쥴리씨</p>
              <p>대표: 홍길동</p>
              <p>사업자등록번호: 000-00-00000</p>
              <p>통신판매업 신고번호: 2025-서울강남-00000</p>
              <p className="pt-1">
                주소: 서울특별시 강남구 테헤란로 123
              </p>
            </div>
          </div>
        </div>

        {/* 하단 카피라이트 */}
        <Separator className="my-6 bg-border/50" />
        <p className="text-xs text-muted-foreground text-center md:text-left">
          &copy; {new Date().getFullYear()} 쥴리씨. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
