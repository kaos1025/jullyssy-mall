import bcrypt from "bcryptjs"

const NAVER_API_BASE = "https://api.commerce.naver.com/external"

export { NAVER_API_BASE }

export const getNaverAccessToken = async () => {
  const clientId = process.env.NAVER_COMMERCE_APP_ID?.trim()
  const clientSecret = process.env.NAVER_COMMERCE_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error("네이버 커머스 API 환경변수가 설정되지 않았습니다")
  }

  // bcrypt 서명 생성 (네이버 커머스 API 스펙)
  // clientSecret은 네이버가 발급한 bcrypt salt ($2a$... 형태)
  const timestamp = Date.now()
  const password = `${clientId}_${timestamp}`
  const hashed = bcrypt.hashSync(password, clientSecret)
  const clientSecretSign = Buffer.from(hashed).toString("base64")

  const res = await fetch(`${NAVER_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      timestamp: String(timestamp),
      client_secret_sign: clientSecretSign,
      grant_type: "client_credentials",
      type: "SELF",
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(`네이버 인증 실패: ${data.error || data.message || JSON.stringify(data)}`)
  }
  return data.access_token as string
}
