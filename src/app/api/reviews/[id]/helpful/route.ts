import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const POST = async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const admin = createAdminClient()

  const { data: review } = await admin
    .from("reviews")
    .select("helpful_count")
    .eq("id", params.id)
    .single()

  if (!review) {
    return NextResponse.json({ error: "리뷰를 찾을 수 없습니다" }, { status: 404 })
  }

  await admin
    .from("reviews")
    .update({ helpful_count: review.helpful_count + 1 })
    .eq("id", params.id)

  return NextResponse.json({ success: true })
}
