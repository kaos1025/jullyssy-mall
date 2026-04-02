import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNaverAccessToken, NAVER_API_BASE } from "@/lib/naver"

interface ChannelProduct {
  channelProductNo: number
  name: string
  salePrice: number
  discountedPrice: number | null
  statusType: string
  detailContent: string | null
  stockQuantity: number
  representativeImage?: { url: string }
  optionalImages?: { url: string }[]
  optionCombinations?: {
    id: number
    optionName1: string
    optionName2: string
    stockQuantity: number
    price: number
  }[]
}

interface NaverProductDetail {
  originProductNo: number
  channelProducts?: ChannelProduct[]
  // 개별 조회 시 직접 필드로 올 수도 있음
  name?: string
  salePrice?: number
  discountedPrice?: number | null
  detailContent?: string | null
  statusType?: string
  stockQuantity?: number
  representativeImage?: { url: string }
  optionalImages?: { url: string }[]
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
  raw: NaverProductDetail
) => {
  // channelProducts 래핑 여부에 따라 데이터 추출
  const cp = raw.channelProducts?.[0]
  const name = cp?.name || raw.name || ""
  const salePrice = cp?.salePrice || raw.salePrice || 0
  const discountedPrice = cp?.discountedPrice || raw.discountedPrice || null
  const detailContent = cp?.detailContent || raw.detailContent || null
  const statusType = cp?.statusType || raw.statusType || ""
  const stockQuantity = cp?.stockQuantity || raw.stockQuantity || 0
  const representImage = cp?.representativeImage || raw.representativeImage
  const optionalImages = cp?.optionalImages || raw.optionalImages || []
  const optionCombinations = cp?.optionCombinations || raw.optionCombinations || []

  // 이미 임포트된 상품인지 확인
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("naver_product_no", String(raw.originProductNo))
    .single()

  if (existing) {
    return { skipped: true }
  }

  // 상품 등록
  const { data: product, error: prodError } = await admin
    .from("products")
    .insert({
      name,
      description: detailContent,
      price: salePrice,
      sale_price: discountedPrice,
      status: statusType === "SALE" ? "ACTIVE" : "HIDDEN",
      naver_product_no: String(raw.originProductNo),
    })
    .select()
    .single()

  if (prodError || !product) {
    throw new Error("상품 등록 실패")
  }

  // 대표 이미지 등록
  if (representImage?.url) {
    await admin.from("product_images").insert({
      product_id: product.id,
      url: representImage.url,
      is_thumbnail: true,
      sort_order: 0,
    })
  }

  // 추가 이미지 등록
  for (let i = 0; i < optionalImages.length; i++) {
    if (optionalImages[i]?.url) {
      await admin.from("product_images").insert({
        product_id: product.id,
        url: optionalImages[i].url,
        is_thumbnail: false,
        sort_order: i + 1,
      })
    }
  }

  // 옵션 등록
  for (const opt of optionCombinations) {
    await admin.from("product_options").insert({
      product_id: product.id,
      color: opt.optionName1 || "기본",
      size: opt.optionName2 || "FREE",
      stock: opt.stockQuantity || 0,
      extra_price: opt.price ? opt.price - salePrice : 0,
      naver_option_id: opt.id ? String(opt.id) : null,
    })
  }

  // 옵션이 없으면 기본 옵션 추가
  if (optionCombinations.length === 0) {
    await admin.from("product_options").insert({
      product_id: product.id,
      color: "기본",
      size: "FREE",
      stock: stockQuantity,
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
          `${NAVER_API_BASE}/v1/products/${productNo}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!detailRes.ok) {
          failCount++
          errors.push(`상품번호 ${productNo}: 상세 조회 실패`)
          continue
        }

        const np: NaverProductDetail = await detailRes.json()
        const result = await importSingleProduct(admin, np)

        if (result.skipped) {
          successCount++
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
