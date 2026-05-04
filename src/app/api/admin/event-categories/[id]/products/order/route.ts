import { NextRequest, NextResponse } from "next/server"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { updateEventCategoryProductOrderAdmin } from "@/lib/events"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PATCH = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const adminUser = await verifyAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const body = await request.json()
  const { ordering } = body

  if (!Array.isArray(ordering) || ordering.length === 0) {
    return NextResponse.json(
      { error: "순서 정보를 입력하세요" },
      { status: 400 }
    )
  }
  if (ordering.length > 200) {
    return NextResponse.json(
      { error: "한 번에 최대 200건까지 순서를 변경할 수 있습니다" },
      { status: 400 }
    )
  }

  const seen = new Set<string>()
  for (const item of ordering) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.product_id !== "string" ||
      !UUID_RE.test(item.product_id)
    ) {
      return NextResponse.json(
        { error: "잘못된 상품 ID 형식입니다" },
        { status: 400 }
      )
    }
    if (
      !Number.isInteger(item.display_order) ||
      item.display_order < 0 ||
      item.display_order > 99999
    ) {
      return NextResponse.json(
        { error: "display_order는 0 이상 정수여야 합니다" },
        { status: 400 }
      )
    }
    if (seen.has(item.product_id)) {
      return NextResponse.json(
        { error: "동일한 상품이 중복되어 있습니다" },
        { status: 400 }
      )
    }
    seen.add(item.product_id)
  }

  try {
    await updateEventCategoryProductOrderAdmin(
      params.id,
      ordering.map((o: { product_id: string; display_order: number }) => ({
        product_id: o.product_id,
        display_order: o.display_order,
      }))
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "순서 변경 실패"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
