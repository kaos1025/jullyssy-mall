import { NextResponse } from "next/server"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { authLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"

const getHandler = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const redirect = searchParams.get("redirect") || "/"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

export const GET = withRateLimit(authLimiter, getHandler)
