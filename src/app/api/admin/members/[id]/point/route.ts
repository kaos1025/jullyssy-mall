import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const POST = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
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
