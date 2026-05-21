import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminOrderStatusAllowed } from "@/lib/order/status-transitions"

// 취소는 POST /api/admin/orders/[id]/cancel 전용 — 사유(reason) 입력 강제.
// PATCH는 배송 운영 상태 전이 + 송장 입력만 처리한다.
const patchHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await request.json()
  const orderId = params.id

  // body.status를 무검증 update하면 어드민 실수/내부자 위협으로 PAID→RETURNED 등
  // status만 전이되어 cancelOrder를 우회한 결제 환불 누락이 가능 → 화이트리스트 강제.
  // CANCELLED는 화이트리스트에 없어 자동으로 거부 (전용 cancel 라우트로 유도).
  const updateData: Record<string, string> = {}

  if (body.status !== undefined) {
    if (!isAdminOrderStatusAllowed(body.status)) {
      return NextResponse.json(
        { error: "허용되지 않은 상태값입니다" },
        { status: 400 }
      )
    }
    updateData.status = body.status
  }
  if (body.courier) updateData.courier = body.courier
  if (body.tracking_no) updateData.tracking_no = body.tracking_no

  const { error } = await admin
    .from("orders")
    .update(updateData)
    .eq("id", orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const PATCH = withRateLimit(adminLimiter, patchHandler)
