import { NextRequest, NextResponse } from "next/server"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { ordersLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"
import { createClaim } from "@/lib/order/return-claim"
import { isClaimType, isReasonCategory } from "@/lib/order/claim"

const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { type, reasonCategory, reasonDetail, exchangeToOptionId } = body as {
    type?: unknown
    reasonCategory?: unknown
    reasonDetail?: unknown
    exchangeToOptionId?: unknown
  }

  if (!isClaimType(type)) {
    return NextResponse.json(
      { error: "유효하지 않은 신청 유형입니다" },
      { status: 400 }
    )
  }

  if (!isReasonCategory(reasonCategory)) {
    return NextResponse.json(
      { error: "유효하지 않은 사유입니다" },
      { status: 400 }
    )
  }

  const reasonDetailCoerced: string | null =
    typeof reasonDetail === "string" ? reasonDetail : null
  const exchangeToOptionIdCoerced: string | null =
    typeof exchangeToOptionId === "string" ? exchangeToOptionId : null

  const result = await createClaim({
    orderId: params.id,
    userId: user.id,
    type,
    reasonCategory,
    reasonDetail: reasonDetailCoerced,
    exchangeToOptionId: exchangeToOptionIdCoerced,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, claimId: result.claimId })
}

export const POST = withRateLimit(ordersLimiter, postHandler)
