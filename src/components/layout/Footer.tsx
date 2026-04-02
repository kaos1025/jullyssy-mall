"use client"

import { useState } from "react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { ChevronDown } from "lucide-react"

const Footer = () => {
  const [showBizInfo, setShowBizInfo] = useState(false)

  return (
    <footer className="border-t border-gray-200 bg-gray-50 pb-24 md:pb-0">
      <div className="container py-8 md:py-12">
        {/* PC: 3열 그리드 / 모바일: 1열 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* 회사 정보 */}
          <div>
            <h3 className="font-bold text-primary mb-2">쥴리씨</h3>
            <p className="text-sm text-muted-foreground">
              트렌디한 여성의류 온라인 스토어
            </p>
          </div>

          <Separator className="md:hidden" />

          {/* 고객센터 */}
          <div>
            <h4 className="text-sm font-semibold mb-2">고객센터</h4>
            <p className="text-xl font-bold mb-1">1234-5678</p>
            <p className="text-sm text-muted-foreground">평일 10:00 - 17:00</p>
            <p className="text-sm text-muted-foreground">점심 12:00 - 13:00 / 주말·공휴일 휴무</p>
          </div>

          <Separator className="md:hidden" />

          {/* 이용안내 */}
          <div>
            <h4 className="text-sm font-semibold mb-2">이용안내</h4>
            <nav className="flex flex-col gap-1.5">
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                이용안내
              </Link>
            </nav>
          </div>
        </div>

        <Separator className="my-6" />

        {/* 사업자 정보 — 모바일: 접기/펼치기, PC: 항상 표시 */}
        <div className="mb-4">
          <button
            onClick={() => setShowBizInfo(!showBizInfo)}
            className="flex items-center gap-1 text-xs text-muted-foreground md:hidden"
          >
            사업자 정보
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showBizInfo ? "rotate-180" : ""}`}
            />
          </button>
          <div className={`text-xs text-muted-foreground leading-relaxed mt-2 md:block ${showBizInfo ? "block" : "hidden"}`}>
            <p>상호: 쥴리씨 | 대표: 홍길동 | 사업자등록번호: 000-00-00000</p>
            <p>주소: 서울특별시 강남구 테헤란로 123</p>
            <p>통신판매업 신고번호: 2025-서울강남-00000</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center md:text-left">
          &copy; {new Date().getFullYear()} 쥴리씨. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
