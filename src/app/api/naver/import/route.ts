import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { adminLimiter } from "@/lib/rate-limit/limiters"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNaverAccessToken, NAVER_API_BASE } from "@/lib/naver"
import { toSlug, dedupeSlug } from "@/lib/slug"
import { extractFitFromDescription, extractFitFromTags } from "@/lib/seo/description-parser"
import {
  getNaverAttributeDict,
  lookupFitFromProductAttributes,
} from "@/lib/seo/naver-attribute-dict"
import type { FitType } from "@/lib/product/fit-type"
import { isApparelTopSlug } from "@/lib/product/category"

interface ImportItem {
  productNo: string
  channelProductNo: string | null
}

interface OptionCombination {
  id?: number
  optionName1?: string
  optionName2?: string
  optionName3?: string
  stockQuantity?: number
  price?: number
  usable?: boolean
}

interface OptionInfo {
  optionCombinationGroupNames?: {
    optionGroupName1?: string
    optionGroupName2?: string
    optionGroupName3?: string
  }
  optionCombinations?: OptionCombination[]
  optionStandards?: OptionCombination[]
}

interface OriginProduct {
  statusType: string
  name: string
  detailContent: string | null
  images?: {
    representativeImage?: { url: string }
    optionalImages?: { url: string }[]
  }
  salePrice: number
  stockQuantity: number
  leafCategoryId?: string
  wholeCategoryName?: string
  customerBenefit?: {
    immediateDiscountPolicy?: {
      discountMethod?: {
        value: number
        unitType: "WON" | "PERCENT"
      }
    }
  }
  detailAttribute?: {
    optionInfo?: OptionInfo
    originAreaInfo?: {
      originAreaCode?: string
      content?: string
    }
    productAttributes?: Array<{ attributeSeq: number; attributeValueSeq: number }>
    [key: string]: unknown
  }
  seoInfo?: {
    sellerTags?: { code?: number; text?: string }[]
  }
}

interface ChannelProductDetail {
  originProduct: OriginProduct
  smartstoreChannelProduct?: unknown
}

// fit_type 결정 (v0.8 A-2). Layer 1 productAttributes+dictionary → 1.5 sellerTags
// → 2 description 휴리스틱 → 3 REGULAR default. 각 Layer 실패는 다음 Layer로 진행.
const resolveFitType = async (
  op: OriginProduct,
  naverCategoryId: string | null,
  token: string
): Promise<FitType> => {
  // Layer 1: productAttributes + 카테고리 dictionary (가장 신뢰도 높음)
  if (naverCategoryId) {
    try {
      const dict = await getNaverAttributeDict(naverCategoryId, token)
      const fit = lookupFitFromProductAttributes(
        op.detailAttribute?.productAttributes ?? [],
        dict
      )
      if (fit) return fit
    } catch {
      // dictionary 조회 실패 → 하위 Layer로 진행 (import 차단 금지)
    }
  }

  // Layer 1.5: sellerTags 키워드
  const fitFromTags = extractFitFromTags(
    (op.seoInfo?.sellerTags ?? []).map((t) => t.text)
  )
  if (fitFromTags) return fitFromTags

  // Layer 2: description 휴리스틱
  const fitFromDesc = extractFitFromDescription(op.detailContent)
  if (fitFromDesc) return fitFromDesc

  // Layer 3: default
  return "REGULAR"
}

const importSingleProduct = async (
  admin: ReturnType<typeof createAdminClient>,
  originProductNo: string,
  detail: ChannelProductDetail,
  token: string,
  existingSlugs: Set<string>
) => {
  const op = detail.originProduct
  if (!op) throw new Error("originProduct 없음")

  const name = op.name || ""
  const originalPrice = op.salePrice || 0
  const discount = op.customerBenefit?.immediateDiscountPolicy?.discountMethod
  let salePrice: number | null = null
  if (discount) {
    if (discount.unitType === "WON") {
      salePrice = originalPrice - discount.value
    } else if (discount.unitType === "PERCENT") {
      salePrice = Math.round(originalPrice * (1 - discount.value / 100))
    }
  }
  const detailContent = op.detailContent || null
  const statusType = op.statusType || ""
  const stockQuantity = op.stockQuantity || 0
  const representImage = op.images?.representativeImage
  const optionalImages = op.images?.optionalImages || []
  const origin = op.detailAttribute?.originAreaInfo?.content || null
  const naverCategoryId = op.leafCategoryId ? String(op.leafCategoryId) : null
  const naverCategoryName = op.wholeCategoryName || null
  const searchTags = op.seoInfo?.sellerTags
    ?.map((tag) => tag.text)
    .filter(Boolean) as string[] ?? []

  // 이미 임포트된 상품인지 확인 (삭제된 상품은 제외)
  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("naver_product_no", originProductNo)
    .neq("status", "DELETED")
    .single()

  if (existing) {
    return { skipped: true }
  }

  // 카테고리 매핑 처리
  let categoryId: string | null = null
  if (naverCategoryId) {
    // 매핑 테이블에서 조회
    const { data: mapping } = await admin
      .from("naver_category_mappings")
      .select("category_id")
      .eq("naver_category_id", naverCategoryId)
      .single()

    if (mapping) {
      categoryId = mapping.category_id
    } else {
      // 매핑이 없으면 카테고리 이름을 API로 조회 후 새 행 추가
      let categoryName = naverCategoryName
      if (!categoryName) {
        try {
          const catRes = await fetch(
            `${NAVER_API_BASE}/v1/categories/${naverCategoryId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          if (catRes.ok) {
            const catData = await catRes.json()
            categoryName = catData.wholeCategoryName || null
          }
        } catch {
          // 카테고리명 조회 실패해도 임포트는 계속 진행
        }
      }
      await admin.from("naver_category_mappings").insert({
        naver_category_id: naverCategoryId,
        naver_category_name: categoryName,
      })
    }
  }

  // fit_type 결정 (신규 상품만 — skip된 기존 상품은 위에서 early return)
  // Track G: 비의류(가방/신발/악세서리)는 fit 무의미 → NULL (의류만 추출)
  let isApparelProduct = false
  if (categoryId) {
    const { data: cat } = await admin
      .from("categories")
      .select("slug, parent_id")
      .eq("id", categoryId)
      .maybeSingle()
    if (cat) {
      if (cat.parent_id) {
        const { data: pcat } = await admin
          .from("categories")
          .select("slug")
          .eq("id", cat.parent_id)
          .maybeSingle()
        isApparelProduct = isApparelTopSlug(pcat?.slug)
      } else {
        isApparelProduct = isApparelTopSlug(cat.slug)
      }
    }
  }
  const fitType: FitType | null = isApparelProduct
    ? await resolveFitType(op, naverCategoryId, token)
    : null

  // slug 생성 (NOT NULL + UNIQUE 제약 사전 충돌 방지)
  // toSlug는 빈 결과 시 throw → 상위 try/catch에서 errors[]로 기록됨
  const baseSlug = toSlug(name)
  const slug = dedupeSlug(baseSlug, existingSlugs)

  // 상품 등록
  const { data: product, error: prodError } = await admin
    .from("products")
    .insert({
      name,
      slug,
      description: detailContent,
      price: originalPrice,
      sale_price: salePrice,
      category_id: categoryId,
      origin,
      status: statusType === "SALE" ? "ACTIVE" : "HIDDEN",
      naver_product_no: originProductNo,
      search_tags: searchTags,
      fit_type: fitType,
    })
    .select()
    .single()

  if (prodError || !product) {
    throw new Error("상품 등록 실패")
  }

  // INSERT 성공한 경우에만 dedupe 풀에 반영 (실패 시 동일 slug 재사용 허용)
  existingSlugs.add(slug)

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

  // 옵션 등록 (detailAttribute.optionInfo.optionCombinations)
  const optionInfo = op.detailAttribute?.optionInfo
  const optionCombinations = optionInfo?.optionCombinations || optionInfo?.optionStandards || []
  const validOptions = optionCombinations.filter((o) => o.usable !== false)

  if (validOptions.length > 0) {
    for (const opt of validOptions) {
      await admin.from("product_options").insert({
        product_id: product.id,
        color: opt.optionName1 || "기본",
        size: opt.optionName2 || "FREE",
        stock: opt.stockQuantity || 0,
        extra_price: opt.price ? opt.price - originalPrice : 0,
        naver_option_id: opt.id ? String(opt.id) : null,
      })
    }
  } else {
    // 옵션이 없으면 기본 옵션 추가
    await admin.from("product_options").insert({
      product_id: product.id,
      color: "기본",
      size: "FREE",
      stock: stockQuantity,
      extra_price: 0,
    })
  }

  // SEO 생성 큐 등록 (#48-1 Phase 1)
  // 실패 시 임포트 자체는 성공으로 처리 (queue 실패는 비치명적).
  try {
    const { error: queueErr } = await admin.from("seo_generation_queue").insert({
      product_id: product.id,
      status: "pending",
      trigger_source: "naver_import",
      description_mode: "replace",
    })
    if (queueErr) {
      Sentry.captureMessage(`seo_generation_queue insert failed: ${queueErr.message}`, {
        level: "warning",
        tags: { area: "seo_queue", trigger: "naver_import" },
        extra: { product_id: product.id },
      })
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "seo_queue", trigger: "naver_import" },
      extra: { product_id: product.id },
    })
  }

  return { skipped: false }
}

const postHandler = async (request: NextRequest) => {
  const user = await verifyAdmin()
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const admin = createAdminClient()
  const body = await request.json()

  // 하위 호환: 기존 productNos 또는 새로운 items 형태 모두 지원
  const items: ImportItem[] = body.items || (body.productNos || []).map((no: string) => ({ productNo: no, channelProductNo: null }))

  if (!items.length) {
    return NextResponse.json({ error: "임포트할 상품을 선택해주세요" }, { status: 400 })
  }

  if (items.length > 500) {
    return NextResponse.json({ error: "한번에 500개까지만 임포트 가능합니다" }, { status: 400 })
  }

  let successCount = 0
  let failCount = 0
  const errors: string[] = []

  try {
    const token = await getNaverAccessToken()

    // 기존 slug 1회 로드 후 dedupe 풀로 활용 (admin 1명 운영 가정, race 무시)
    const { data: slugRows } = await admin
      .from("products")
      .select("slug")
      .not("slug", "is", null)
    const existingSlugs = new Set<string>(
      slugRows?.map((r) => r.slug as string) ?? []
    )

    for (const item of items) {
      try {
        const channelNo = item.channelProductNo

        if (!channelNo) {
          // channelProductNo가 없으면 검색 API로 조회
          const searchRes = await fetch(`${NAVER_API_BASE}/v1/products/search`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              searchKeywordType: "PRODUCT_NO",
              originProductNos: [Number(item.productNo)],
              page: 1,
              size: 1,
            }),
          })

          if (!searchRes.ok) {
            failCount++
            errors.push(`상품번호 ${item.productNo}: 검색 실패`)
            continue
          }

          const searchData = await searchRes.json()
          const found = searchData.contents?.[0]
          const foundChannelNo = found?.channelProducts?.[0]?.channelProductNo

          if (!foundChannelNo) {
            failCount++
            errors.push(`상품번호 ${item.productNo}: channelProductNo를 찾을 수 없음`)
            continue
          }

          item.channelProductNo = String(foundChannelNo)
        }

        // 채널 상품 상세 조회
        const detailRes = await fetch(
          `${NAVER_API_BASE}/v2/products/channel-products/${item.channelProductNo}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!detailRes.ok) {
          failCount++
          errors.push(`상품번호 ${item.productNo}: 상세 조회 실패 (${detailRes.status})`)
          continue
        }

        const detail: ChannelProductDetail = await detailRes.json()
        await importSingleProduct(admin, item.productNo, detail, token, existingSlugs)
        successCount++
        // 이미 존재하는 상품(skipped)도 성공으로 카운트
      } catch (e) {
        failCount++
        errors.push(`상품번호 ${item.productNo}: ${e instanceof Error ? e.message : "알 수 없는 오류"}`)
      }
    }

    // 동기화 로그 저장
    const totalCount = items.length
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
      total_count: items.length,
      success_count: successCount,
      fail_count: failCount,
      error_details: { errors: [message] },
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withRateLimit(adminLimiter, postHandler)
