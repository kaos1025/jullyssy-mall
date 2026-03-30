import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const NAVER_API_BASE = "https://api.commerce.naver.com/external"

const getNaverAccessToken = async () => {
  const clientId = process.env.NAVER_COMMERCE_APP_ID
  const clientSecret = process.env.NAVER_COMMERCE_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("네이버 커머스 API 환경변수가 설정되지 않았습니다")
  }

  // 타임스탬프 기반 서명 생성
  const timestamp = Date.now()
  const crypto = await import("crypto")
  const signature = crypto
    .createHmac("sha256", clientSecret)
    .update(`${clientId}_${timestamp}`)
    .digest("base64")

  const res = await fetch(`${NAVER_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      timestamp: String(timestamp),
      client_secret_sign: signature,
      grant_type: "client_credentials",
      type: "SELF",
    }),
  })

  if (!res.ok) throw new Error("네이버 인증 실패")
  const data = await res.json()
  return data.access_token as string
}

export const POST = async () => {
  const admin = createAdminClient()

  let totalCount = 0
  let successCount = 0
  let failCount = 0
  const errors: string[] = []

  try {
    const token = await getNaverAccessToken()

    // 상품 목록 조회
    const listRes = await fetch(
      `${NAVER_API_BASE}/v2/products?page=1&size=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!listRes.ok) throw new Error("상품 목록 조회 실패")
    const listData = await listRes.json()
    const naverProducts = listData.contents || []
    totalCount = naverProducts.length

    for (const np of naverProducts) {
      try {
        // 이미 임포트된 상품인지 확인
        const { data: existing } = await admin
          .from("products")
          .select("id")
          .eq("naver_product_no", String(np.originProductNo))
          .single()

        if (existing) {
          successCount++
          continue
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
          failCount++
          errors.push(`${np.name}: 상품 등록 실패`)
          continue
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

        successCount++
      } catch (e) {
        failCount++
        errors.push(`${np.name}: ${e instanceof Error ? e.message : "알 수 없는 오류"}`)
      }
    }

    // 동기화 로그 저장
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
      total_count: totalCount,
      success_count: successCount,
      fail_count: failCount,
      error_details: { errors: [message] },
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
