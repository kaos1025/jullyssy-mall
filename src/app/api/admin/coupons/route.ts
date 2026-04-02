import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async () => {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export const POST = async (request: NextRequest) => {
  const admin = createAdminClient()
  const body = await request.json()

  const { error } = await admin.from("coupons").insert({
    name: body.name,
    code: body.code,
    type: body.type,
    discount_value: body.discount_value,
    min_order_amount: body.min_order_amount || 0,
    max_discount: body.max_discount || null,
    starts_at: body.starts_at,
    expires_at: body.expires_at,
    max_issues: body.max_issues || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
