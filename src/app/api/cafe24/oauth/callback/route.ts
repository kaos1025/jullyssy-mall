import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type Cafe24TokenResponse = {
  access_token?: string
  expires_at?: string
  refresh_token?: string
  refresh_token_expires_at?: string
  client_id?: string
  mall_id?: string
  user_id?: string
  scopes?: string[]
  issued_at?: string
  shop_no?: string
  token_type?: string
  error?: string
  error_description?: string
}

const html = (body: string, status = 200) =>
  new NextResponse(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cafe24 OAuth</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 840px; margin: 48px auto; padding: 0 20px; line-height: 1.65; color: #1f2937; }
      h1 { font-size: 28px; margin-bottom: 8px; }
      h2 { font-size: 18px; margin-top: 28px; }
      code, pre, textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
      pre, textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 10px; padding: 14px; background: #f9fafb; }
      textarea { min-height: 220px; }
      .ok { color: #047857; font-weight: 700; }
      .error { color: #b91c1c; font-weight: 700; }
      .muted { color: #6b7280; }
      .warning { border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 14px; border-radius: 8px; }
    </style>
  </head>
  <body>${body}</body>
</html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const maskToken = (value?: string) => {
  if (!value) return ""
  if (value.length <= 12) return "***"
  return `${value.slice(0, 6)}...${value.slice(-6)} (${value.length} chars)`
}

const requiredEnv = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`)
  return value
}

export const GET = async (request: Request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_description")

  if (error) {
    return html(
      `<h1 class="error">Cafe24 인증 실패</h1>
       <p><strong>error:</strong> ${escapeHtml(error)}</p>
       <p><strong>description:</strong> ${escapeHtml(errorDescription || "")}</p>`,
      400
    )
  }

  if (!code) {
    return html(
      `<h1 class="error">Cafe24 인증 코드가 없습니다</h1>
       <p>Redirect URI 호출에 <code>code</code> 쿼리 파라미터가 포함되어야 합니다.</p>`,
      400
    )
  }

  const expectedState = process.env.CAFE24_OAUTH_STATE || "jullyssy-cafe24-sync"
  if (state !== expectedState) {
    return html(
      `<h1 class="error">Cafe24 state 검증 실패</h1>
       <p>요청 state가 서버에 설정된 값과 일치하지 않습니다.</p>`,
      400
    )
  }

  try {
    const mallId = requiredEnv("CAFE24_MALL_ID")
    const clientId = requiredEnv("CAFE24_CLIENT_ID")
    const clientSecret = requiredEnv("CAFE24_CLIENT_SECRET")
    const redirectUri =
      process.env.CAFE24_REDIRECT_URI || `${url.origin}/api/cafe24/oauth/callback`
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

    const tokenResponse = await fetch(
      `https://${mallId}.cafe24api.com/api/v2/oauth/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
        cache: "no-store",
      }
    )

    const tokenBody = (await tokenResponse.json()) as Cafe24TokenResponse

    if (!tokenResponse.ok) {
      return html(
        `<h1 class="error">Cafe24 토큰 발급 실패</h1>
         <p><strong>HTTP:</strong> ${tokenResponse.status}</p>
         <pre>${escapeHtml(JSON.stringify(tokenBody, null, 2))}</pre>
         <p class="muted">Cafe24 Developers에 등록한 Redirect URI와 <code>CAFE24_REDIRECT_URI</code>가 정확히 같은지 확인하세요.</p>`,
        tokenResponse.status
      )
    }

    const envText = [
      `CAFE24_MALL_ID=${tokenBody.mall_id || mallId}`,
      `CAFE24_ACCESS_TOKEN=${tokenBody.access_token || ""}`,
      `CAFE24_REFRESH_TOKEN=${tokenBody.refresh_token || ""}`,
      `CAFE24_SHOP_NO=${tokenBody.shop_no || "1"}`,
    ].join("\n")

    const safeSummary = {
      mall_id: tokenBody.mall_id,
      user_id: tokenBody.user_id,
      shop_no: tokenBody.shop_no,
      token_type: tokenBody.token_type,
      expires_at: tokenBody.expires_at,
      refresh_token_expires_at: tokenBody.refresh_token_expires_at,
      scopes: tokenBody.scopes,
      access_token: maskToken(tokenBody.access_token),
      refresh_token: maskToken(tokenBody.refresh_token),
    }

    return html(
      `<h1 class="ok">Cafe24 OAuth 토큰 발급 완료</h1>
       <p>아래 값은 한 번만 안전하게 복사해서 VPS worker 환경변수에 반영하세요.</p>
       <div class="warning">
         <strong>주의:</strong> 이 페이지에는 민감한 토큰이 포함됩니다. 화면 공유/로그 저장을 피하고, 복사 후 브라우저 기록 노출에 주의하세요.
       </div>
       <h2>VPS <code>/srv/order-excel-sync/.env</code>에 추가할 값</h2>
       <textarea readonly>${escapeHtml(envText)}</textarea>
       <h2>요약</h2>
       <pre>${escapeHtml(JSON.stringify(safeSummary, null, 2))}</pre>`,
      200
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류"
    return html(
      `<h1 class="error">Cafe24 OAuth 처리 오류</h1>
       <p>${escapeHtml(message)}</p>`,
      500
    )
  }
}
