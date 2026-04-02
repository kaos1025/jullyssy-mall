import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNaverAccessToken, NAVER_API_BASE } from "@/lib/naver"

interface NaverProduct {
  originProductNo: number
  name: string
  salePrice: number
  originalPrice: number
  discountedPrice: number | null
  detailContent: string | null
  statusType: string
  stockQuantity: number
  images?: {
    representativeImage?: { url: string }
    optionalImages?: { url: string }[]
  }
  optionCombinations?: {
    id: number
    optionName1: string
    optionName2: string
    stockQuantity: number
    price: number
  }[]
}

const importSingleProduct = async (
  admin: ReturnType<typeof createAdminClient>,
  np: NaverProduct
) => {
  // 이미 임포트된 상품인지 확인
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("naver_product_no", String(np.originProductNo))
    .single()

  if (existing) {
    return { skipped: true }
  }

  // 상품 등록
  const { data: product, error: prodError } = await admin
    .from("products")
    .insert({
      name: np.name,
      description: np.detailContent || null,
      price: np.salePrice || np.originalPrice || 0,
      sale_price: np.discountedPrice || null,
      status: np.statusType === "SALE" ? "ACTIVE" : "HIDDEN",
      naver_product_no: String(np.originProductNo),
    })
    .select()
    .single()

  if (prodError || !product) {
    throw new Error("상품 등록 실패")
  }

  // 이미지 등록
  const images = np.images?.optionalImages || []
  const representImage = np.images?.representativeImage
  if (representImage?.url) {
    await admin.from("product_images").insert({
      product_id: product.id,
      url: representImage.url,
      is_thumbnail: true,
      sort_order: 0,
    })
  }

  for (let i = 0; i < images.length; i++) {
    if (images[i]?.url) {
      await admin.from("product_images").insert({
        product_id: product.id,
        url: images[i].url,
        is_thumbnail: false,
        sort_order: i + 1,
      })
    }
  }

  // 옵션 등록
  const options = np.optionCombinations || []
  for (const opt of options) {
    await admin.from("product_options").insert({
      product_id: product.id,
      color: opt.optionName1 || "기본",
      size: opt.optionName2 || "FREE",
      stock: opt.stockQuantity || 0,
      extra_price: opt.price ? opt.price - (np.salePrice || 0) : 0,
      naver_option_id: opt.id ? String(opt.id) : null,
    })
  }

  // 옵션이 없으면 기본 옵션 추가
  if (options.length === 0) {
    await admin.from("product_options").insert({
      product_id: product.id,
      color: "기본",
      size: "FREE",
      stock: np.stockQuantity || 0,
      extra_price: 0,
    })
  }

  return { skipped: false }
}

export const POST = async (request: NextRequest) => {
  const admin = createAdminClient()
  const { productNos } = await request.json() as { productNos: string[] }

  if (!productNos?.length) {
    return NextResponse.json({ error: "임포트할 상품을 선택해주세요" }, { status: 400 })
  }

  let successCount = 0
  let failCount = 0
  const errors: string[] = []

  try {
    const token = await getNaverAccessToken()

    for (const productNo of productNos) {
      try {
        // 개별 상품 상세 조회
        const detailRes = await fetch(
          `${NAVER_API_BASE}/v2/products/${productNo}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!detailRes.ok) {
          failCount++
          errors.push(`상품번호 ${productNo}: 상세 조회 실패`)
          continue
        }

        const np: NaverProduct = await detailRes.json()
        const result = await importSingleProduct(admin, np)

        if (result.skipped) {
          successCount++ // 이미 존재하는 상품은 성공으로 카운트
        } else {
          successCount++
        }
      } catch (e) {
        failCount++
        errors.push(`상품번호 ${productNo}: ${e instanceof Error ? e.message : "알 수 없는 오류"}`)
      }
    }

    // 동기화 로그 저장
    const totalCount = productNos.length
    await admin.from("naver_sync_logs").insert({
      sync_type: "IMPORT",
      status: failCount === 0 ? "SUCCESS" : failCount === totalCount ? "FAILED" : "PARTIAL",
      total_count: totalCount,
      success_count: successCount,
      fail_count: failCount,
      error_details: errors.length > 0 ? { errors } : null,
    })

    return NextResponse.json({
      total: totalCount,
      success: successCount,
      fail: failCount,
      errors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "임포트 실패"

    await admin.from("naver_sync_logs").insert({
      sync_type: "IMPORT",
      status: "FAILED",
      total_count: productNos.length,
      success_count: successCount,
      fail_count: failCount,
      error_details: { errors: [message] },
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
