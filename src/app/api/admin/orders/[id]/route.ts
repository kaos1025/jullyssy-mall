import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cancelOrder } from "@/lib/order/cancel-order"

export const PATCH = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const admin = createAdminClient()
  const body = await request.json()
  const orderId = params.id

  // CANCELLED 상태로 변경 시 전체 취소 플로우 실행
  if (body.status === "CANCELLED") {
    const result = await cancelOrder(orderId)

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true })
  }

  // 그 외 상태 변경 (송장입력 포함)
  const updateData: Record<string, string> = {}

  if (body.status) updateData.status = body.status
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
