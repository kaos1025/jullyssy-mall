import { NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

// v0.8 Track 2-A B-2 — SEO draft 일괄 거절.
// reject는 단순 상태 전이(RPC/이미지 처리 없음) → 단일 UPDATE로 일괄 처리.
// pending_review만 대상(이미 처리된 건 자동 제외).

const MAX_BULK = 200

const postHandler = async (request: Request) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string")
    : []
  const note =
    typeof body?.note === "string" && body.note.trim().length > 0
      ? body.note.trim()
      : null

  if (ids.length === 0) {
    return NextResponse.json({ error: "선택된 draft가 없습니다" }, { status: 400 })
  }
  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_BULK}건까지 가능합니다` },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("seo_metadata_drafts")
    .update({
      status: "rejected",
      reviewed_by: adminUser.id,
      reviewed_at: now,
      review_note: note,
      updated_at: now,
    })
    .in("id", ids)
    .eq("status", "pending_review")
    .select("id")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rejected: data?.length ?? 0 })
}

export const POST = withRateLimit(adminLimiter, postHandler)
