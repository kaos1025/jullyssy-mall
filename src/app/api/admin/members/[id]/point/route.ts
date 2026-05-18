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
  const body = await request.json()
  const amount = Number(body.amount)
  const reason: unknown = body.reason
  const userId = params.id

  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json(
      { error: "amount는 0이 아닌 정수여야 합니다" },
      { status: 400 }
    )
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "reason이 필요합니다" }, { status: 400 })
  }

  // 클라가 보낸 currentPoint를 신뢰하던 패턴 제거.
  // RPC가 `point = point + amount` 원자적 갱신 + 음수 잔액 차단 + history 기록까지 단일 트랜잭션으로 처리.
  const { data, error } = await admin.rpc("add_member_point", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  })

  if (error) {
    const isClientError =
      error.message.includes("잔여 포인트가 부족합니다") ||
      error.message.includes("회원을 찾을 수 없습니다") ||
      error.message.includes("amount는 0일 수 없습니다")
    return NextResponse.json(
      { error: error.message },
      { status: isClientError ? 400 : 500 }
    )
  }

  return NextResponse.json({ success: true, ...((data as object) ?? {}) })
}

export const POST = withRateLimit(adminLimiter, postHandler)
