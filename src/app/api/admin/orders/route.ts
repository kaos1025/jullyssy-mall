import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async (request: NextRequest) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { searchParams } = request.nextUrl
  const status = searchParams.get("status") || "ALL"
  const search = searchParams.get("search") || ""

  let query = admin
    .from("orders")
    .select("*, order_items(product_name, quantity)")
    .order("created_at", { ascending: false })

  if (status === "CANCELLED") {
    query = query.in("status", [
      "CANCELLED",
      "RETURN_REQUESTED",
      "RETURNED",
      "EXCHANGE_REQUESTED",
      "EXCHANGED",
    ])
  } else if (status !== "ALL") {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(
      `order_no.ilike.%${search}%,recipient.ilike.%${search}%,recipient_phone.ilike.%${search}%`
    )
  }

  const { data, error } = await query.limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
