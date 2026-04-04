export function validateEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_TOSS_CLIENT_KEY",
    "TOSS_SECRET_KEY",
  ]

  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `❌ 필수 환경변수 누락: ${missing.join(", ")}\n` +
        `.env.local 파일을 확인해주세요.`
    )
  }

  // 프로덕션에서 테스트 키 사용 방지
  if (process.env.NODE_ENV === "production") {
    const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
    const tossSecretKey = process.env.TOSS_SECRET_KEY || ""

    if (tossClientKey.startsWith("test_")) {
      throw new Error(
        "❌ 프로덕션에서 토스페이먼츠 테스트 키를 사용하고 있습니다!"
      )
    }
    if (tossSecretKey.startsWith("test_")) {
      throw new Error(
        "❌ 프로덕션에서 토스페이먼츠 테스트 시크릿 키를 사용하고 있습니다!"
      )
    }
  }

  // 개발환경에서 라이브 키 사용 경고
  if (process.env.NODE_ENV === "development") {
    const tossClientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
    if (tossClientKey.startsWith("live_")) {
      console.warn(
        "⚠️ 개발환경에서 토스페이먼츠 라이브 키를 사용하고 있습니다. 실제 결제가 발생할 수 있습니다!"
      )
    }
  }
}
