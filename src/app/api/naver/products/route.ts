import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNaverAccessToken, NAVER_API_BASE } from "@/lib/naver"

interface NaverSearchItem {
  originProductNo: number
  channelProducts: {
    channelProductNo: number
    name: string
    salePrice: number
    discountedPrice: number | null
    statusType: string
    representativeImage?: { url: string }
  }[]
}

export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl
  const page = parseInt(searchParams.get("page") || "1", 10)
  const size = parseInt(searchParams.get("size") || "100", 10)
  const keyword = searchParams.get("keyword") || ""

  try {
    const token = await getNaverAccessToken()

    // 검색 조건 구성
    const isProductNoSearch = keyword && /^\d+$/.test(keyword)

    const searchBody: Record<string, unknown> = { page, size, productStatusTypes: ["SALE"] }
    if (isProductNoSearch) {
      searchBody.searchKeywordType = "CHANNEL_PRODUCT_NO"
      searchBody.channelProductNos = [Number(keyword)]
    }

    const listRes = await fetch(`${NAVER_API_BASE}/v1/products/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(searchBody),
    })

    if (!listRes.ok) throw new Error("상품 목록 조회 실패")
    const listData = await listRes.json()
    let naverProducts: NaverSearchItem[] = listData.contents || []
    const total = listData.totalElements || naverProducts.length

    // 상품명 검색: 네이버 API가 지원하지 않으므로 서버에서 필터링
    if (keyword && !isProductNoSearch) {
      const kw = keyword.toLowerCase()
      naverProducts = naverProducts.filter((item) => {
        const name = item.channelProducts?.[0]?.name || ""
        return name.toLowerCase().includes(kw)
      })
    }

    // 이미 임포트된 상품번호를 한번에 조회 → Set
    const admin = createAdminClient()
    const { data: imported } = await admin
      .from("products")
      .select("naver_product_no")
      .not("naver_product_no", "is", null)
      .neq("status", "DELETED")

    const importedSet = new Set(
      (imported || []).map((p) => p.naver_product_no)
    )

    const contents = naverProducts.map((item) => {
      const cp = item.channelProducts?.[0]
      return {
        productNo: String(item.originProductNo),
        channelProductNo: cp?.channelProductNo ? String(cp.channelProductNo) : null,
        name: cp?.name || "",
        price: cp?.salePrice || 0,
        salePrice: cp?.discountedPrice || null,
        status: cp?.statusType || "",
        imageUrl: cp?.representativeImage?.url || null,
        alreadyImported: importedSet.has(String(item.originProductNo)),
      }
    })

    return NextResponse.json({
      contents,
      total: keyword && !isProductNoSearch ? contents.length : total,
      page,
      size,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "상품 목록 조회 실패"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
