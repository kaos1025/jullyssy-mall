import Link from "next/link"
import { Separator } from "@/components/ui/separator"

const Footer = () => {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* 회사 정보 */}
          <div>
            <h3 className="text-lg font-bold text-primary mb-3">쥴리씨</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              트렌디한 여성의류 온라인 스토어
            </p>
          </div>

          {/* 고객센터 */}
          <div>
            <h4 className="font-semibold mb-3">고객센터</h4>
            <p className="text-sm text-muted-foreground">
              평일 10:00 - 17:00 (점심 12:00 - 13:00)
            </p>
            <p className="text-sm text-muted-foreground">
              주말/공휴일 휴무
            </p>
          </div>

          {/* 이용안내 */}
          <div>
            <h4 className="font-semibold mb-3">이용안내</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                개인정보처리방침
              </Link>
              <Link href="/guide" className="hover:text-foreground transition-colors">
                이용안내
              </Link>
            </nav>
          </div>
        </div>

        <Separator className="my-6" />

        <p className="text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} 쥴리씨. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default Footer
