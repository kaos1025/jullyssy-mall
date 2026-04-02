import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const GET = async () => {
  const admin = createAdminClient()

  // 매핑 목록 + 연결된 쥴리씨 카테고리 정보
  const { data: mappings, error } = await admin
    .from("naver_category_mappings")
    .select("*, categories(id, name, parent_id)")
    .order("naver_category_name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 쥴리씨 카테고리 전체 목록 (드롭다운용)
  const { data: categories } = await admin
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })

  return NextResponse.json({ mappings: mappings || [], categories: categories || [] })
}

export const POST = async (request: NextRequest) => {
  const admin = createAdminClient()
  const { mappings } = await request.json() as {
    mappings: { id: string; category_id: string | null }[]
  }

  if (!mappings?.length) {
    return NextResponse.json({ error: "매핑 데이터가 없습니다" }, { status: 400 })
  }

  const errors: string[] = []

  for (const mapping of mappings) {
    const { error } = await admin
      .from("naver_category_mappings")
      .update({ category_id: mapping.category_id })
      .eq("id", mapping.id)

    if (error) {
      errors.push(`${mapping.id}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(", ") }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
