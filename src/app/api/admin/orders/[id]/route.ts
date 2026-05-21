import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isAdminOrderStatusAllowed,
  isTerminalOrderStatus,
} from "@/lib/order/status-transitions"

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

  // P1-22 terminal freeze — status 변경 시 현재 상태가 terminal(CANCELLED/DELIVERED)이면 거부.
  // 송장/courier만 단독으로 보내는 경우는 통과 (배송 완료 후 송장 정정 등 운영 케이스 보존).
  if (body.status !== undefined) {
    const { data: currentOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single()

    if (!currentOrder) {
      return NextResponse.json(
        { error: "주문을 찾을 수 없습니다" },
        { status: 404 }
      )
    }

    if (isTerminalOrderStatus(currentOrder.status)) {
      return NextResponse.json(
        {
          code: "ORDER_TERMINAL_STATE",
          message: "취소되었거나 배송 완료된 주문은 상태를 변경할 수 없습니다.",
        },
        { status: 409 }
      )
    }
  }

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
