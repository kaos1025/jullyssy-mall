import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async (request: NextRequest) => {
  const admin = createAdminClient()
  const search = request.nextUrl.searchParams.get("search") || ""

  let query = admin
    .from("profiles")
    .select("*, orders(id)")
    .order("created_at", { ascending: false })

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
    )
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const members = (data || []).map((m) => ({
    ...m,
    order_count: m.orders?.length || 0,
  }))

  return NextResponse.json(members)
}
