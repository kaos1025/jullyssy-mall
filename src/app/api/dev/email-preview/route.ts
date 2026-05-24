import { render } from "@react-email/render"
import { NextResponse, type NextRequest } from "next/server"

import { send } from "@/lib/email/send"
import {
  SAMPLE_SUBJECTS,
  isTemplateKey,
  renderByKey,
  type TemplateKey,
} from "@/lib/email/templates/_fixtures"

// 개발/PM 검증 전용 — production 차단
// GET  ?template=<key>&format=html|text   → 메일 본문 렌더 결과 반환
// POST ?template=<key>  body { to }       → 실제 발송 (헤더 x-resend-key 검증)
//
// template keys (default: order-confirmation):
//   - order-confirmation   (Phase 2-A)
//   - shipping-started     (Phase 2-B)
//   - shipping-delivered   (Phase 2-B)
//   - refund-completed     (Phase 2-B)
//
// 처리 계획:
// - 본 라우트는 VERCEL_ENV === "production"에서 404 — 영구 gate
// - 신규 템플릿 추가 시 _fixtures.tsx만 확장하면 본 라우트는 변경 불필요

const isProduction = () => process.env.VERCEL_ENV === "production"

function notAvailable() {
  return NextResponse.json(
    { error: "Not available in production" },
    { status: 404 }
  )
}

function resolveTemplate(req: NextRequest): TemplateKey | null {
  const raw = new URL(req.url).searchParams.get("template") ?? "order-confirmation"
  return isTemplateKey(raw) ? raw : null
}

export async function GET(req: NextRequest) {
  if (isProduction()) return notAvailable()

  const key = resolveTemplate(req)
  if (!key) {
    return NextResponse.json(
      { error: "Unknown template", allowed: Object.keys(SAMPLE_SUBJECTS) },
      { status: 404 }
    )
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format") ?? "html"
  const element = renderByKey(key)

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

  const key = resolveTemplate(req)
  if (!key) {
    return NextResponse.json(
      { error: "Unknown template", allowed: Object.keys(SAMPLE_SUBJECTS) },
      { status: 404 }
    )
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
      event: `${key.replace(/-/g, "_")}_dev_test`,
      to: body.to,
      subject: SAMPLE_SUBJECTS[key],
      react: renderByKey(key),
    })
    return NextResponse.json({ ok: true, id: data?.id, template: key })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
