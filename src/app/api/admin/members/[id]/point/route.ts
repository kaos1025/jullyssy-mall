import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { amount, reason, currentPoint } = await request.json()
  const userId = params.id

  if (!amount || !reason) {
    return NextResponse.json({ error: "amount와 reason이 필요합니다" }, { status: 400 })
  }

  // 포인트 업데이트
  const { error: updateError } = await admin
    .from("profiles")
    .update({ point: currentPoint + amount })
    .eq("id", userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // 히스토리 기록
  const { error: historyError } = await admin
    .from("point_histories")
    .insert({ user_id: userId, amount, reason })

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(adminLimiter, postHandler)
