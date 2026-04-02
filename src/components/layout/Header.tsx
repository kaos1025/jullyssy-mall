"use client"

import Link from "next/link"
import { Search, ShoppingBag, User, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const itemCount = useCart((s) => s.getItemCount())

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md shadow-sm">
      <div className="container flex h-14 items-center">
        {/* 모바일: 햄버거 메뉴 (좌측) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">메뉴</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] overflow-y-auto">
            <nav className="flex flex-col gap-2 mt-8">
              {/* 로그인/마이페이지 */}
              <Link
                href="/mypage"
                className="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b border-border/50 mb-2"
              >
                <User className="h-4 w-4" strokeWidth={1.5} />
                마이페이지
              </Link>

              {/* 전체상품 */}
              <Link
                href="/products"
                className="px-3 py-2.5 text-sm font-medium hover:text-primary transition-colors"
              >
                전체상품
              </Link>

              {/* 카테고리 아코디언 */}
              <Accordion type="multiple" className="w-full">
                {categories.map((cat) =>
                  cat.children.length > 0 ? (
                    <AccordionItem key={cat.id} value={cat.id} className="border-none">
                      <AccordionTrigger className="px-3 py-2.5 text-sm font-medium hover:text-primary hover:no-underline">
                        {cat.name}
                      </AccordionTrigger>
                      <AccordionContent className="pb-1">
                        <div className="flex flex-col">
                          <Link
                            href={`/products?category=${cat.slug}`}
                            className="px-6 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            {cat.name} 전체
                          </Link>
                          {cat.children.map((child) => (
                            <Link
                              key={child.id}
                              href={`/products?category=${child.slug}`}
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

        {/* 모바일: 로고 중앙 */}
        <div className="flex-1 flex justify-center md:justify-start">
          <Link href="/" className="flex items-center">
            <span className="text-xl font-bold text-primary">쥴리씨</span>
          </Link>
        </div>

        {/* PC: 카테고리 네비게이션 */}
        <nav className="hidden md:flex items-center gap-6 text-sm ml-8">
          <Link
            href="/products"
            className="transition-colors hover:text-primary py-4"
          >
            전체상품
          </Link>
          {categories.map((cat) => (
            <div key={cat.id} className="relative group">
              <Link
                href={`/products?category=${cat.slug}`}
                className="transition-colors hover:text-primary py-4 block"
              >
                {cat.name}
              </Link>
              {/* 2depth 드롭다운 (hover) */}
              {cat.children.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="bg-white rounded shadow-md border border-border/30 py-2 min-w-[140px]">
                    {cat.children.map((child) => (
                      <Link
                        key={child.id}
                        href={`/products?category=${child.slug}`}
                        className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors whitespace-nowrap"
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

        {/* 우측 아이콘 */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="hidden md:flex" asChild>
            <Link href="/search">
              <Search className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">검색</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <Link href="/search">
              <Search className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">검색</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="hidden md:flex" asChild>
            <Link href="/mypage">
              <User className="h-5 w-5" strokeWidth={1.5} />
              <span className="sr-only">마이페이지</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/cart">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {itemCount > 99 ? "99" : itemCount}
                </span>
              )}
              <span className="sr-only">장바구니</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
