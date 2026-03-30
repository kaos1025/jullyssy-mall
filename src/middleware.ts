import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const protectedPaths = ["/mypage", "/checkout"]
const authPaths = ["/login", "/signup"]
const adminPaths = ["/admin"]

export const middleware = async (request: NextRequest) => {
  const { user, supabaseResponse } = await updateSession(request)
  const { pathname } = request.nextUrl

  // 어드민 경로: 로그인 필수 + 이메일 화이트리스트
  if (adminPaths.some((path) => pathname.startsWith(path))) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())

    if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  // 보호 경로: 로그인 필수
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }
  }

  // 인증 페이지: 이미 로그인 시 홈으로
  if (authPaths.some((path) => pathname.startsWith(path))) {
    if (user) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
