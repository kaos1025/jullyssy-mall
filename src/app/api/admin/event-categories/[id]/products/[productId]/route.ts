import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { removeEventCategoryProductAdmin } from "@/lib/events"

const deleteHandler = async (
  _request: NextRequest,
  { params }: { params: { id: string; productId: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  try {
    await removeEventCategoryProductAdmin(params.id, params.productId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "매칭 제거 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const DELETE = withRateLimit(adminLimiter, deleteHandler)
