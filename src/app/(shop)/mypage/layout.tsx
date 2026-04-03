"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Package,
  MapPin,
  Ticket,
  Coins,
  MessageSquare,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  { href: "/mypage/orders", label: "주문내역", icon: Package },
  { href: "/mypage/addresses", label: "배송지관리", icon: MapPin },
  { href: "/mypage/coupons", label: "쿠폰", icon: Ticket },
  { href: "/mypage/points", label: "포인트", icon: Coins },
  { href: "/mypage/reviews", label: "리뷰", icon: MessageSquare },
  { href: "/mypage/profile", label: "회원정보", icon: User },
]

const MypageLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()

  return (
    <div className="container py-6">
      <h1 className="text-xl font-bold mb-6">마이페이지</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* 사이드 메뉴 */}
        <nav aria-label="마이페이지 메뉴" className="md:col-span-1">
          <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* 콘텐츠 */}
        <div className="md:col-span-3">{children}</div>
      </div>
    </div>
  )
}

export default MypageLayout
