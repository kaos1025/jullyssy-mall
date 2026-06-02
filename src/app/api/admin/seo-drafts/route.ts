import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { getSeoDraftsPendingPaginatedAdmin } from "@/lib/seo/drafts"

// 일괄 검수 뷰가 전 pending을 한 번에 fetch (Track 2-A). default는 20 유지.
// payload 주의: list item에 product_description(HTML)/spec_metadata 포함 — 100건 상한.
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

const getHandler = async (request: NextRequest) => {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const url = new URL(request.url)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(url.searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT,
    ),
  )
  const offset = Math.max(
    0,
    parseInt(url.searchParams.get("offset") ?? "", 10) || 0,
  )

  try {
    const result = await getSeoDraftsPendingPaginatedAdmin(limit, offset)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "draft 목록 조회 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withRateLimit(adminLimiter, getHandler)
