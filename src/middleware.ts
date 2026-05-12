import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { adminEmails } from "@/lib/env"
import { verifyCsrf } from "@/lib/security/csrf"

const protectedPaths = ["/mypage", "/checkout"]
const authPaths = ["/login", "/signup"]
const adminPaths = ["/admin"]

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl

  // CSRF 보호: /api/* state-changing 요청은 page 가드/updateSession 전에 차단
  // TODO(csrf-rebase): Sentry 통합 후 console.warn → Sentry.captureMessage 일괄 교체
  if (pathname.startsWith("/api/")) {
    const csrfResult = verifyCsrf(request)
    if (!csrfResult.ok) {
      console.warn(
        `[CSRF blocked] ${request.method} ${pathname} — ${csrfResult.reason}`
      )
      return NextResponse.json(
        { error: "CSRF validation failed", code: "CSRF_FAILED" },
        { status: 403 }
      )
    }
  }

  const { user, supabaseResponse } = await updateSession(request)

  // 어드민 경로: 로그인 필수 + 이메일 화이트리스트
  if (adminPaths.some((path) => pathname.startsWith(path))) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("redirect", pathname)
      return NextResponse.redirect(url)
    }

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
