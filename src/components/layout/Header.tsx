"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, ShoppingBag, User, Heart, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useCart } from "@/hooks/use-cart"
import type { CategoryWithChildren } from "@/types"

interface HeaderProps {
  categories: CategoryWithChildren[]
}

const Header = ({ categories }: HeaderProps) => {
  const router = useRouter()
  const itemCount = useCart((s) => s.getItemCount())
  const [searchQuery, setSearchQuery] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchQuery("")
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm shadow-sm">
      {/* 1행: 로고 + 검색바 + 아이콘 — 56px */}
      <div className="container flex h-14 items-center gap-4">
        {/* 모바일: 햄버거 */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0">
              <Menu className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] overflow-y-auto">
            <nav className="flex flex-col gap-1 mt-8">
              {/* 마이페이지 */}
              <Link
                href="/mypage"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-2.5 px-3 py-3 text-sm font-medium border-b border-border/50"
              >
                <User className="h-4 w-4" strokeWidth={1.5} />
                마이페이지
              </Link>
              {/* 찜 */}
              <Link
                href="/mypage"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-2.5 px-3 py-3 text-sm font-medium border-b border-border/50 mb-1"
              >
                <Heart className="h-4 w-4" strokeWidth={1.5} />
                찜한 상품
              </Link>

              {/* 전체상품 */}
              <Link
                href="/products"
                onClick={() => setSheetOpen(false)}
                className="px-3 py-2.5 text-sm font-medium hover:text-primary transition-colors"
              >
                전체상품
              </Link>

              {/* 카테고리 아코디언 */}
              <Accordion type="multiple" className="w-full">
                {categories.map((cat) =>
                  cat.children.length > 0 ? (
                    <AccordionItem
                      key={cat.id}
                      value={cat.id}
                      className="border-none"
                    >
                      <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:text-primary hover:no-underline">
                        {cat.name}
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <div className="flex flex-col">
                          <Link
                            href={`/products?category=${cat.slug}`}
                            onClick={() => setSheetOpen(false)}
                            className="px-6 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            {cat.name} 전체
                          </Link>
                          {cat.children.map((child) => (
                            <Link
                              key={child.id}
                              href={`/products?category=${child.slug}`}
                              onClick={() => setSheetOpen(false)}
                              className="px-6 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ) : (
                    <Link
                      key={cat.id}
                      href={`/products?category=${cat.slug}`}
                      onClick={() => setSheetOpen(false)}
                      className="px-3 py-2.5 text-sm font-medium hover:text-primary transition-colors block"
                    >
                      {cat.name}
                    </Link>
                  )
                )}
              </Accordion>
            </nav>
          </SheetContent>
        </Sheet>

        {/* 로고 */}
        <Link href="/" className="shrink-0">
          <span className="font-display tracking-wider text-xl text-primary">
            쥴리씨
          </span>
        </Link>

        {/* PC 검색바 — 중앙 */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 justify-center"
        >
          <div className="relative w-full max-w-[400px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🌷 봄 신상 BEST 아이템"
              className="pl-10 pr-4 h-9 rounded-full bg-muted border-0 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
        </form>

        {/* 모바일: 로고 중앙 정렬용 spacer */}
        <div className="flex-1 md:hidden" />

        {/* 우측 아이콘 */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* 모바일 검색 아이콘 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            asChild
          >
            <Link href="/search">
              <Search className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">검색</span>
            </Link>
          </Button>
          {/* PC: 마이페이지 */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            asChild
          >
            <Link href="/mypage">
              <User className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">마이페이지</span>
            </Link>
          </Button>
          {/* PC: 찜 */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex"
            asChild
          >
            <Link href="/mypage">
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">찜</span>
            </Link>
          </Button>
          {/* 장바구니 */}
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {itemCount > 99 ? "99" : itemCount}
                </span>
              )}
              <span className="sr-only">장바구니</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2행: 카테고리 네비게이션 — PC 44px, 모바일 가로스크롤 */}
      <div className="border-t border-border/50">
        <div className="container">
          {/* PC: hover 드롭다운 */}
          <nav className="hidden md:flex items-center gap-6 h-11 text-sm">
            <Link
              href="/products"
              className="transition-colors hover:text-primary font-medium"
            >
              전체상품
            </Link>
            {categories.map((cat) => (
              <div key={cat.id} className="relative group h-full flex items-center">
                <Link
                  href={`/products?category=${cat.slug}`}
                  className="transition-colors hover:text-primary"
                >
                  {cat.name}
                </Link>
                {cat.children.length > 0 && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-white rounded-md shadow-md border border-border/30 py-2 min-w-[140px]">
                      {cat.children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/products?category=${child.slug}`}
                          className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors whitespace-nowrap"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* 모바일: 가로 스크롤 */}
          <nav className="md:hidden flex items-center gap-4 h-10 overflow-x-auto scrollbar-hide text-sm px-1">
            <Link
              href="/products"
              className="shrink-0 transition-colors hover:text-primary font-medium"
            >
              전체
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="shrink-0 transition-colors hover:text-primary text-muted-foreground"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
