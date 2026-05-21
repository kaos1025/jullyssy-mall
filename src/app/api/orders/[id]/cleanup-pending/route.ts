import { NextResponse } from "next/server"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { ordersLimiter } from "@/lib/rate-limit/limiters"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cleanupPendingOrder } from "@/lib/order/cleanup-pending-order"

// 토스 결제창에서 사용자가 X/뒤로가기로 결제를 취소했을 때 호출.
// cancelOrder()는 PAID/PREPARING만 받으므로 PENDING은 본 라우트로 분리.
const postHandler = async (
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

  const result = await cleanupPendingOrder(admin, params.id, "USER_CANCEL")

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  return NextResponse.json({ success: true })
}

export const POST = withRateLimit(ordersLimiter, postHandler)
