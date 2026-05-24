import { render } from "@react-email/render"
import { NextResponse, type NextRequest } from "next/server"

import { send } from "@/lib/email/send"
import { renderOrderConfirmationSample } from "@/lib/email/templates/_fixtures"

// 개발/PM 검증 전용 — production 차단
// GET  ?format=html|text  → 메일 본문 렌더 결과 반환
// POST { to: string }     → 실제 발송 (헤더 x-resend-key 검증, RESEND_API_KEY와 일치 필수)
//
// 처리 계획 (PM 검토 항목):
// - 본 라우트는 VERCEL_ENV === "production"에서 404 — 영구 gate
// - Phase 3 진입 후 결제 confirm 호출부로 통합되면 본 라우트는 다음 옵션 중 선택:
//   (a) 제거: 검증 사이클 종료 시 정리
//   (b) 유지: 신규 템플릿 추가 시 회귀 검증용 영구 보존 — 권고

const isProduction = () => process.env.VERCEL_ENV === "production"

function notAvailable() {
  return NextResponse.json(
    { error: "Not available in production" },
    { status: 404 }
  )
}

export async function GET(req: NextRequest) {
  if (isProduction()) return notAvailable()

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "html"

  const element = renderOrderConfirmationSample()

  if (format === "text") {
    const text = await render(element, { plainText: true })
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  const html = await render(element)
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function POST(req: NextRequest) {
  if (isProduction()) return notAvailable()

  // RESEND_API_KEY 보유자만 호출 가능 (별도 env 도입 없이 자연 보호)
  const provided = req.headers.get("x-resend-key")
  const expected = process.env.RESEND_API_KEY
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { to?: string | string[] } = {}
  try {
    body = (await req.json()) as { to?: string | string[] }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body.to) {
    return NextResponse.json({ error: "'to' required" }, { status: 400 })
  }

  try {
    const data = await send({
      event: "order_confirmation_dev_test",
      to: body.to,
      subject: "[쥴리씨] 주문 확정 안내 (dev test)",
      react: renderOrderConfirmationSample(),
    })
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
