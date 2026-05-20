// categories 캐시 수동 무효화 endpoint.
//
// CATEGORIES-CACHE-AUDIT-1 (P0): src/lib/categories.ts의 unstable_cache(tag
// 'categories')를 무효화. 현재 categories 변경은 Supabase Studio/SQL 직접 경로로
// 이뤄지므로 admin CRUD 라우트 부재 — 변경 후 운영자가 본 endpoint를 호출해
// shop 전역(GNB/PDP/필터/sidemap) 캐시를 즉시 재생성한다.

import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"

export const POST = async () => {
  const admin = await verifyAdmin()
  if (!admin) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  revalidateTag("categories")
  return NextResponse.json({ ok: true, tag: "categories" })
}
