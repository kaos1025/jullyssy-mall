"use client"

import Link from "next/link"
import { Search, ShoppingBag, User, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* 모바일 메뉴 */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px]">
            <nav className="flex flex-col gap-4 mt-8">
              <Link href="/products" className="text-lg font-medium">
                전체상품
              </Link>
              <Link href="/products?category=top" className="text-lg font-medium">
                상의
              </Link>
              <Link href="/products?category=bottom" className="text-lg font-medium">
                하의
              </Link>
              <Link href="/products?category=outer" className="text-lg font-medium">
                아우터
              </Link>
              <Link href="/products?category=dress" className="text-lg font-medium">
                원피스/세트
              </Link>
              <Link href="/products?category=acc" className="text-lg font-medium">
                가방/악세서리
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        {/* 로고 */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="text-xl font-bold text-primary">쥴리씨</span>
        </Link>

        {/* PC 네비게이션 */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/products" className="transition-colors hover:text-primary">
            전체상품
          </Link>
          <Link href="/products?category=top" className="transition-colors hover:text-primary">
            상의
          </Link>
          <Link href="/products?category=bottom" className="transition-colors hover:text-primary">
            하의
          </Link>
          <Link href="/products?category=outer" className="transition-colors hover:text-primary">
            아우터
          </Link>
          <Link href="/products?category=dress" className="transition-colors hover:text-primary">
            원피스/세트
          </Link>
          <Link href="/products?category=acc" className="transition-colors hover:text-primary">
            가방/악세서리
          </Link>
        </nav>

        {/* 우측 아이콘 */}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Search className="h-5 w-5" />
            <span className="sr-only">검색</span>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/mypage">
              <User className="h-5 w-5" />
              <span className="sr-only">마이페이지</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" />
              <span className="sr-only">장바구니</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
