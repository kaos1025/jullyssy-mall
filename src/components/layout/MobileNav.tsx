"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Grid2X2, Heart, User, ShoppingBag } from "lucide-react"
import { useCart } from "@/hooks/use-cart"
import { useUser } from "@/hooks/use-user"

const navItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/products", label: "카테고리", icon: Grid2X2 },
  // TODO: 찜 기능 구현 후 /wishlist로 변경
  { href: "/mypage", label: "찜", icon: Heart },
  { href: "/mypage", label: "마이", icon: User, id: "mypage" },
  { href: "/cart", label: "장바구니", icon: ShoppingBag, id: "cart" },
]

const MobileNav = () => {
  const pathname = usePathname()
  const itemCount = useCart((s) => s.getItemCount())
  const { user, mounted: authMounted } = useUser()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <nav aria-label="모바일 네비게이션" className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-[60px]">
        {navItems.map((item) => {
          const key = item.id ?? item.label
          const resolvedHref =
            item.id === "mypage" && authMounted && !user
              ? "/login"
              : item.href
          const isActive =
            resolvedHref === "/"
              ? pathname === "/"
              : pathname.startsWith(resolvedHref)

          return (
            <Link
              key={key}
              href={resolvedHref}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full ${
                isActive ? "text-primary" : "text-gray-400"
              }`}
            >
              <span className="relative">
                <item.icon size={22} strokeWidth={1.5} />
                {item.id === "cart" && mounted && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-primary text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                    {itemCount > 99 ? "99" : itemCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default MobileNav
