import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const POINT_RATE = 0.01 // 1%

export const POST = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  // 주문 조회
  const { data: order } = await admin
    .from("orders")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!order) {
    return NextResponse.json(
      { error: "주문을 찾을 수 없습니다" },
      { status: 404 }
    )
  }

  if (order.status !== "DELIVERED") {
    return NextResponse.json(
      { error: "구매확정할 수 없는 주문 상태입니다" },
      { status: 400 }
    )
  }

  // 구매확정 + 포인트 적립 (주문금액의 1%)
  const pointReward = Math.floor(order.paid_amount * POINT_RATE)

  await admin
    .from("orders")
    .update({ status: "CONFIRMED" })
    .eq("id", order.id)

  if (pointReward > 0) {
    const { data: profile } = await admin
      .from("profiles")
      .select("point")
      .eq("id", user.id)
      .single()

    if (profile) {
      await admin
        .from("profiles")
        .update({ point: profile.point + pointReward })
        .eq("id", user.id)

      await admin.from("point_histories").insert({
        user_id: user.id,
        amount: pointReward,
        reason: "구매확정 적립",
        order_id: order.id,
      })
    }
  }

  return NextResponse.json({ success: true, point_reward: pointReward })
}
