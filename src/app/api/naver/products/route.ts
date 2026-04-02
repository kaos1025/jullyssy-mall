import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNaverAccessToken, NAVER_API_BASE } from "@/lib/naver"

export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get("page") || "1", 10)
  const size = parseInt(searchParams.get("size") || "20", 10)

  try {
    const token = await getNaverAccessToken()

    const listRes = await fetch(
      `${NAVER_API_BASE}/v2/products?page=${page}&size=${size}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!listRes.ok) throw new Error("상품 목록 조회 실패")
    const listData = await listRes.json()
    const naverProducts = listData.contents || []
    const total = listData.totalElements || naverProducts.length

    // 이미 임포트된 상품번호를 한번에 조회 → Set
    const admin = createAdminClient()
    const { data: imported } = await admin
      .from("products")
      .select("naver_product_no")
      .not("naver_product_no", "is", null)

    const importedSet = new Set(
      (imported || []).map((p) => p.naver_product_no)
    )

    const contents = naverProducts.map((np: {
      originProductNo: number
      name: string
      salePrice: number
      originalPrice: number
      discountedPrice: number | null
      statusType: string
      images?: {
        representativeImage?: { url: string }
      }
    }) => ({
      productNo: String(np.originProductNo),
      name: np.name,
      price: np.salePrice || np.originalPrice || 0,
      salePrice: np.discountedPrice || null,
      status: np.statusType,
      imageUrl: np.images?.representativeImage?.url || null,
      alreadyImported: importedSet.has(String(np.originProductNo)),
    }))

    return NextResponse.json({ contents, total, page, size })
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품 목록 조회 실패"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
