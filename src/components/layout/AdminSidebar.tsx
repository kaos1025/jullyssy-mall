"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Ticket,
} from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/products", label: "상품관리", icon: Package },
  { href: "/admin/orders", label: "주문관리", icon: ShoppingCart },
  { href: "/admin/members", label: "회원관리", icon: Users },
  { href: "/admin/coupons", label: "쿠폰관리", icon: Ticket },
]

const AdminSidebar = () => {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/30 min-h-screen">
      <div className="p-6">
        <Link href="/admin" className="text-xl font-bold text-primary">
          쥴리씨 관리자
        </Link>
      </div>
      <nav className="flex-1 px-3">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors mb-1",
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
      </nav>
    </aside>
  )
}

export default AdminSidebar
