import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

interface RouteContext {
  params: { id: string }
}

interface RejectBody {
  note?: string
}

const postHandler = async (request: NextRequest, context: RouteContext) => {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body: RejectBody = await request.json().catch(() => ({}))
  const note =
    typeof body?.note === "string" && body.note.trim().length > 0
      ? body.note.trim()
      : null

  const supabase = createAdminClient()

  const { data: draftRow, error: fetchErr } = await supabase
    .from("seo_metadata_drafts")
    .select("status")
    .eq("id", context.params.id)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!draftRow) {
    return NextResponse.json({ error: "draft 없음" }, { status: 404 })
  }
  if (draftRow.status !== "pending_review") {
    return NextResponse.json(
      {
        error: `pending_review 상태 draft만 거절 가능합니다 (현재: ${draftRow.status})`,
      },
      { status: 409 },
    )
  }

  const { error: updateErr } = await supabase
    .from("seo_metadata_drafts")
    .update({
      status: "rejected",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      review_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.params.id)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const POST = withRateLimit(adminLimiter, postHandler)
