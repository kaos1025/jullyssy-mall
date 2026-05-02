import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getEventCategoryProductsAdmin,
  addEventCategoryProductsAdmin,
} from "@/lib/events"

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GET = async (
  _request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  try {
    const products = await getEventCategoryProductsAdmin(params.id)
    return NextResponse.json(products)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "매칭 상품 조회 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json()
  const { product_ids } = body

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return NextResponse.json(
      { error: "상품 ID를 1개 이상 입력하세요" },
      { status: 400 }
    )
  }
  if (product_ids.length > 100) {
    return NextResponse.json(
      { error: "한 번에 최대 100건까지 매칭할 수 있습니다" },
      { status: 400 }
    )
  }
  for (const pid of product_ids) {
    if (typeof pid !== "string" || !UUID_RE.test(pid)) {
      return NextResponse.json(
        { error: "잘못된 상품 ID 형식입니다" },
        { status: 400 }
      )
    }
  }

  // 중복 제거 (요청 내부 중복은 skipped로 잡히지만 명시적으로 dedupe)
  const uniqueIds = Array.from(new Set<string>(product_ids))

  try {
    const result = await addEventCategoryProductsAdmin(params.id, uniqueIds)
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "매칭 추가 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
