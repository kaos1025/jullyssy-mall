import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const PATCH = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const admin = createAdminClient()
  const body = await request.json()
  const orderId = params.id

  // 송장입력 또는 상태변경
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
