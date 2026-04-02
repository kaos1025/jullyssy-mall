import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async (request: NextRequest) => {
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
