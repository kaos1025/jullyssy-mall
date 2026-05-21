import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { cancelOrder } from "@/lib/order/cancel-order"
import { isAdminCancelReason } from "@/lib/order/cancellation"

// 어드민 취소 전용 라우트 — 기존 PATCH /api/admin/orders/[id] CANCELLED 분기에서 분리.
// 사유(ADMIN_CANCEL_REASONS) 필수, note 선택. cancelOrder()에 actor='ADMIN' 전달.
const postHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { reason, note } = body as { reason?: unknown; note?: unknown }

  if (!isAdminCancelReason(reason)) {
    return NextResponse.json(
      { error: "유효하지 않은 취소 사유입니다" },
      { status: 400 }
    )
  }

  const result = await cancelOrder(params.id, {
    actor: "ADMIN",
    reason,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  })

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(adminLimiter, postHandler)
