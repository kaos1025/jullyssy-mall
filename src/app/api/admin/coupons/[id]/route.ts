import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

export const PATCH = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await request.json()

  // code, type은 변경 불가
  const allowedFields = ["name", "min_order_price", "max_discount", "expires_at", "is_active", "total_quantity"]
  const updateData: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "수정할 항목이 없습니다" }, { status: 400 })
  }

  const { data, error } = await admin
    .from("coupons")
    .update(updateData)
    .eq("id", params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
