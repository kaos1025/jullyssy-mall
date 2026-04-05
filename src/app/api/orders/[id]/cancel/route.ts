import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cancelOrder } from "@/lib/order/cancel-order"

export const POST = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  // 본인 주문 확인
  const admin = createAdminClient()
  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!order) {
    return NextResponse.json(
      { error: "주문을 찾을 수 없습니다" },
      { status: 404 }
    )
  }

  const result = await cancelOrder(params.id)

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  return NextResponse.json({ success: true })
}
