import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"

const getHandler = async (request: NextRequest) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

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

export const GET = withRateLimit(adminLimiter, getHandler)
