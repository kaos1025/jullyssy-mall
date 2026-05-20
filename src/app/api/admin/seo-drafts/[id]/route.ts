import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSeoDraftDetailAdmin } from "@/lib/seo/drafts"
import type { DraftImageAlt } from "@/types/seo"

interface RouteContext {
  params: { id: string }
}

const META_TITLE_MAX = 60
const META_DESCRIPTION_MAX = 155
const SEARCH_TAGS_MIN = 5
const SEARCH_TAGS_MAX = 10
const ALT_TEXT_MAX = 100

interface PatchBody {
  meta_title?: string
  meta_description?: string
  search_tags?: string[]
  image_alt_texts?: DraftImageAlt[]
}

type Validation =
  | { ok: true; data: PatchBody }
  | { ok: false; error: string }

const validatePatchBody = (body: unknown): Validation => {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "잘못된 요청 형식" }
  }
  const b = body as Record<string, unknown>
  const out: PatchBody = {}

  if (b.meta_title !== undefined) {
    if (typeof b.meta_title !== "string") {
      return { ok: false, error: "meta_title은 문자열이어야 합니다" }
    }
    if (b.meta_title.length > META_TITLE_MAX) {
      return {
        ok: false,
        error: `meta_title은 ${META_TITLE_MAX}자 이내여야 합니다`,
      }
    }
    out.meta_title = b.meta_title
  }

  if (b.meta_description !== undefined) {
    if (typeof b.meta_description !== "string") {
      return { ok: false, error: "meta_description은 문자열이어야 합니다" }
    }
    if (b.meta_description.length > META_DESCRIPTION_MAX) {
      return {
        ok: false,
        error: `meta_description은 ${META_DESCRIPTION_MAX}자 이내여야 합니다`,
      }
    }
    out.meta_description = b.meta_description
  }

  if (b.search_tags !== undefined) {
    if (!Array.isArray(b.search_tags)) {
      return { ok: false, error: "search_tags는 배열이어야 합니다" }
    }
    if (!b.search_tags.every((t) => typeof t === "string")) {
      return { ok: false, error: "search_tags 원소는 문자열이어야 합니다" }
    }
    if (
      b.search_tags.length < SEARCH_TAGS_MIN ||
      b.search_tags.length > SEARCH_TAGS_MAX
    ) {
      return {
        ok: false,
        error: `search_tags는 ${SEARCH_TAGS_MIN}~${SEARCH_TAGS_MAX}개여야 합니다`,
      }
    }
    out.search_tags = b.search_tags as string[]
  }

  if (b.image_alt_texts !== undefined) {
    if (!Array.isArray(b.image_alt_texts)) {
      return { ok: false, error: "image_alt_texts는 배열이어야 합니다" }
    }
    const alts: DraftImageAlt[] = []
    for (const item of b.image_alt_texts) {
      if (typeof item !== "object" || item === null) {
        return { ok: false, error: "image_alt_texts 원소 형식 오류" }
      }
      const r = item as Record<string, unknown>
      if (
        typeof r.image_index !== "number" ||
        !Number.isInteger(r.image_index) ||
        r.image_index < 0 ||
        r.image_index > 2
      ) {
        return { ok: false, error: "image_index는 0~2 정수여야 합니다" }
      }
      if (typeof r.alt_text !== "string") {
        return { ok: false, error: "alt_text는 문자열이어야 합니다" }
      }
      if (r.alt_text.length > ALT_TEXT_MAX) {
        return {
          ok: false,
          error: `alt_text는 ${ALT_TEXT_MAX}자 이내여야 합니다`,
        }
      }
      alts.push({ image_index: r.image_index, alt_text: r.alt_text })
    }
    out.image_alt_texts = alts
  }

  return { ok: true, data: out }
}

const getHandler = async (_request: NextRequest, context: RouteContext) => {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  try {
    const draft = await getSeoDraftDetailAdmin(context.params.id)
    if (!draft) {
      return NextResponse.json({ error: "draft 없음" }, { status: 404 })
    }
    return NextResponse.json(draft)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "draft 조회 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const patchHandler = async (request: NextRequest, context: RouteContext) => {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const v = validatePatchBody(body)
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 })
  }

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
        error: `pending_review 상태의 draft만 수정 가능합니다 (현재: ${draftRow.status})`,
      },
      { status: 409 },
    )
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (v.data.meta_title !== undefined) updates.meta_title = v.data.meta_title
  if (v.data.meta_description !== undefined)
    updates.meta_description = v.data.meta_description
  if (v.data.search_tags !== undefined) updates.search_tags = v.data.search_tags
  if (v.data.image_alt_texts !== undefined)
    updates.image_alt_texts = v.data.image_alt_texts

  const { error: updateErr } = await supabase
    .from("seo_metadata_drafts")
    .update(updates)
    .eq("id", context.params.id)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export const GET = withRateLimit(adminLimiter, getHandler)
export const PATCH = withRateLimit(adminLimiter, patchHandler)
