import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminOrderStatusBulkAllowed } from "@/lib/order/status-transitions"

const patchHandler = async (request: NextRequest) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { ids, status } = await request.json()

  if (!ids?.length || !status) {
    return NextResponse.json({ error: "ids와 status가 필요합니다" }, { status: 400 })
  }

  // bulk CANCELLED는 cancelOrder 플로우(토스 환불/재고/포인트/쿠폰)를 일괄 누락시키므로
  // 화이트리스트로 차단. 개별 취소는 단건 라우트의 CANCELLED 분기로 처리.
  if (!isAdminOrderStatusBulkAllowed(status)) {
    return NextResponse.json(
      { error: "일괄 변경에 허용되지 않은 상태값입니다" },
      { status: 400 }
    )
  }

  const { error } = await admin
    .from("orders")
    .update({ status })
    .in("id", ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const PATCH = withRateLimit(adminLimiter, patchHandler)
