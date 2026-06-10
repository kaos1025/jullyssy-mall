import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { approveClaim } from "@/lib/order/return-claim"

const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { confirmedDeduction } = body as { confirmedDeduction?: unknown }

  if (typeof confirmedDeduction !== "number") {
    return NextResponse.json(
      { error: "차감액을 입력해주세요" },
      { status: 400 }
    )
  }

  const result = await approveClaim(params.id, confirmedDeduction, user.id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(adminLimiter, postHandler)
