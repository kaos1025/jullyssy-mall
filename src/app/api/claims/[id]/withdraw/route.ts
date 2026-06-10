import { NextRequest, NextResponse } from "next/server"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { ordersLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"
import { withdrawClaim } from "@/lib/order/return-claim"

const postHandler = async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const result = await withdrawClaim(params.id, user.id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(ordersLimiter, postHandler)
