import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { removeEventCategoryProductAdmin } from "@/lib/events"

const verifyAdmin = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())

  if (!adminEmails.includes(user.email?.toLowerCase() || "")) return null
  return user
}

export const DELETE = async (
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
