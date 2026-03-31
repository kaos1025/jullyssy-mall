import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

  // 주문 조회 (본인 확인)
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items:order_items(*)")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single()

  if (!order) {
    return NextResponse.json(
      { error: "주문을 찾을 수 없습니다" },
      { status: 404 }
    )
  }

  if (!["PAID", "PREPARING"].includes(order.status)) {
    return NextResponse.json(
      { error: "취소할 수 없는 주문 상태입니다" },
      { status: 400 }
    )
  }

  // 재고 원복
  for (const item of order.order_items) {
    const { data: option } = await admin
      .from("product_options")
      .select("stock")
      .eq("id", item.product_option_id)
      .single()

    if (option) {
      await admin
        .from("product_options")
        .update({ stock: option.stock + item.quantity })
        .eq("id", item.product_option_id)
    }
  }

  // 포인트 환불
  if (order.point_used > 0) {
    const { data: profile } = await admin
      .from("profiles")
      .select("point")
      .eq("id", user.id)
      .single()

    if (profile) {
      await admin
        .from("profiles")
        .update({ point: profile.point + order.point_used })
        .eq("id", user.id)

      await admin.from("point_histories").insert({
        user_id: user.id,
        amount: order.point_used,
        reason: "주문 취소 환불",
        order_id: order.id,
      })
    }
  }

  // 쿠폰 반환
  await admin
    .from("user_coupons")
    .update({ used_at: null, order_id: null })
    .eq("order_id", order.id)

  // 주문 상태 변경
  await admin
    .from("orders")
    .update({ status: "CANCELLED" })
    .eq("id", order.id)

  return NextResponse.json({ success: true })
}
