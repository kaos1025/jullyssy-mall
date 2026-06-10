import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { exchangeReship } from "@/lib/order/return-claim"

const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { tracking, courier } = body as {
    tracking?: unknown
    courier?: unknown
  }

  if (
    typeof tracking !== "string" ||
    !tracking.trim() ||
    typeof courier !== "string" ||
    !courier.trim()
  ) {
    return NextResponse.json(
      { error: "송장번호와 택배사를 입력해주세요" },
      { status: 400 }
    )
  }

  const result = await exchangeReship(params.id, tracking, courier, user.id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(adminLimiter, postHandler)
