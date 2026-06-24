import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getNaverAccessToken, NAVER_API_BASE } from "@/lib/naver"

// Node 런타임 고정(default). createAdminClient(service role) + 네이버 커머스 REST(bcrypt 토큰) +
// Sentry(Node)를 한 런타임에서. 캐시 금지(매 실행 신규 조회).
export const dynamic = "force-dynamic"
export const maxDuration = 120

// 네이버 검색 청크 크기(originProductNos 한 번에 조회할 개수).
const SEARCH_CHUNK_SIZE = 100
// 1단 검색 청크 동시성. 순차면 카탈로그 확대(645≈7청크×15s=105s) 시 pg_net 60s 초과 →
// 병렬(5) + 예산 가드로 바운드(645도 ~2웨이브 ≈ 30s).
const SEARCH_CONCURRENCY = 5
// 2단(상세 조회) 동시성 + 1회 실행 회전 cap. 순차 호출이 maxDuration(120s)을 넘기지 않도록
// 병렬 + 예산 + CAP으로 pg_net(60s)·maxDuration 내 바운드. 초과분은 다음 회전이 처리.
const DETAIL_CONCURRENCY = 5
const DETAIL_CAP = 80
// per-call 타임아웃(단일 네이버 호출이 무한정 매달리지 않도록). gsc-sync와 동일 정책.
const NAVER_CALL_TIMEOUT_MS = 15_000
// 전체 wall-clock 예산. deadline은 핸들러 진입 시각 기준(auth+1단 소요도 예산에 포함) →
// 최악도 pg_net(60s)·maxDuration(120s) 안에 바운드. 초과분 SALE 상세는 다음 회전이 처리.
const WALLCLOCK_BUDGET_MS = 40_000

// pg_cron + pg_net이 vault 'naver_sync_auth' Bearer로 호출. 인바운드 인증.
// empty-secret 가드: CRON_SECRET 미설정 시 어떤 요청도 인증 실패(open-door 방지).
const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

// 네이버 검색(/v1/products/search, searchKeywordType:PRODUCT_NO) 응답 형태.
// 실측 확인: api/naver/products/route.ts NaverSearchItem, api/naver/import/route.ts search 사용부.
interface NaverSearchChannelProduct {
  channelProductNo: number
  statusType: string
}
interface NaverSearchItem {
  originProductNo: number
  channelProducts?: NaverSearchChannelProduct[]
}
interface NaverSearchResponse {
  contents?: NaverSearchItem[]
}

// 상세(/v2/products/channel-products/{channelProductNo}) 응답 중 본 라우트가 읽는 부분만.
// 재고 동기화에 필요한 필드만 좁게 타이핑(가격/설명/이미지 등은 의도적으로 미참조).
interface NaverOptionCombination {
  id?: number
  stockQuantity?: number
  usable?: boolean
}
interface NaverChannelProductDetail {
  originProduct?: {
    stockQuantity?: number
    detailAttribute?: {
      optionInfo?: {
        optionCombinations?: NaverOptionCombination[]
        optionStandards?: NaverOptionCombination[]
      }
    }
  }
}

// 동기화 대상 상품 + 옵션. naver_product_no 키로 묶어 1단/2단에서 공유.
interface TargetOption {
  id: string
  naver_option_id: string | null
  stock: number
}
interface TargetProduct {
  id: string
  naver_product_no: string
  options: TargetOption[]
}

// per-call 타임아웃을 입힌 네이버 fetch 래퍼. AbortSignal.timeout으로 단일 호출 상한.
// 한 호출이 매달려도 전체 예산을 갉아먹지 않도록(gsc-sync per-call timeout 미러).
const naverFetch = (url: string, init: RequestInit, token: string) =>
  fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(NAVER_CALL_TIMEOUT_MS),
  })

// 배열 청크 헬퍼.
const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const handler = async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // ?dryRun=1 — 네이버 읽기는 수행하되 모든 DB 쓰기(stock/status/sync_log) skip, 집계만 반환.
  // 활성화 전 전건 프리뷰(0 쓰기)로 실데이터 판정을 전수 대조하는 게이트 + 운영 중 상시 디버그.
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"

  const admin = createAdminClient()

  // phase는 에러 시 Sentry 태그로. 진행 단계별 갱신.
  let phase = "load_targets"
  // 2단(상세 조회) wall-clock 예산 기준점(핸들러 진입 시각 기준).
  const deadlineMs = Date.now() + WALLCLOCK_BUDGET_MS

  // 집계 카운터: total=대상 상품 수, success=판정/갱신 성공, fail=건별 실패. errors는 dead-letter.
  let totalCount = 0
  let successCount = 0
  let failCount = 0
  const errors: string[] = []
  // 비-dryRun에서 DB 쓰기가 한 건이라도 발생했는지(완료 시 revalidateTag 판단).
  let changeWritten = false

  try {
    // ── 대상 로드 ────────────────────────────────────────────────────────────
    // products: naver_product_no 有 AND status != 'DELETED'. 각 상품의 product_options 동반 로드.
    phase = "load_targets"
    const { data: productRows, error: productsError } = await admin
      .from("products")
      .select("id, naver_product_no, product_options(id, naver_option_id, stock)")
      .not("naver_product_no", "is", null)
      .neq("status", "DELETED")
    if (productsError) throw productsError

    const targets: TargetProduct[] = (productRows ?? []).map(
      (p: {
        id: string
        naver_product_no: string
        product_options:
          | { id: string; naver_option_id: string | null; stock: number | null }[]
          | null
      }) => ({
        id: p.id,
        naver_product_no: p.naver_product_no,
        options: (p.product_options ?? []).map((o) => ({
          id: o.id,
          naver_option_id: o.naver_option_id,
          stock: o.stock ?? 0,
        })),
      }),
    )
    totalCount = targets.length

    if (targets.length === 0) {
      if (!dryRun) {
        await admin.from("naver_sync_logs").insert({
          sync_type: "STOCK_SYNC",
          status: "SUCCESS",
          total_count: 0,
          success_count: 0,
          fail_count: 0,
          error_details: null,
        })
      }
      return NextResponse.json({
        ok: true,
        dryRun,
        total: 0,
        success: 0,
        fail: 0,
        saleProducts: 0,
        detailProcessed: 0,
      })
    }

    // naver_product_no → TargetProduct 인덱스(검색 결과를 originProductNo로 역매핑).
    const byProductNo = new Map<string, TargetProduct>()
    for (const t of targets) byProductNo.set(t.naver_product_no, t)

    // ── 인증 ─────────────────────────────────────────────────────────────────
    phase = "auth"
    const token = await getNaverAccessToken()

    // ── 1단(전수, cheap, 오버셀 안전) ─────────────────────────────────────────
    // 청크 단위 search → statusType 판정. 분기:
    //   SALE        → 2단 후보(옵션 재고는 상세 필요).
    //   비-SALE      → 해당 상품 모든 옵션 stock=0(품절, 오버셀 차단). 상품 status는 유지.
    //   검색 미반환  → 스토어에서 삭제 → products.status='HIDDEN'.
    phase = "stage1_search"
    const saleProducts: { product: TargetProduct; channelProductNo: number }[] = []
    const returnedProductNos = new Set<string>()
    // search 청크 자체가 실패한 상품 번호. HIDDEN 판정에서 제외(삭제로 오판 금지 — 오버셀보다
    // 잘못된 숨김이 더 위험. 검색 실패는 일시적일 수 있으므로 상태/재고 모두 미터치가 안전).
    const chunkFailedProductNos = new Set<string>()

    const searchChunks = chunk(targets, SEARCH_CHUNK_SIZE)

    // 청크 1개 처리(search → 항목별 SALE 수집 / 비-SALE 품절). 공유 상태(set/카운터/saleProducts)는
    // 동기 변형만 하므로 병렬 인터리브에도 안전(JS 단일 스레드).
    const processSearchChunk = async (group: TargetProduct[]) => {
      const originProductNos = group.map((t) => Number(t.naver_product_no))
      const searchRes = await naverFetch(
        `${NAVER_API_BASE}/v1/products/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            searchKeywordType: "PRODUCT_NO",
            originProductNos,
            page: 1,
            size: group.length,
          }),
        },
        token,
      )
      if (!searchRes.ok) {
        // 청크 단위 실패는 격리: 해당 청크 상품들을 fail로 집계하고 다음 청크 진행.
        failCount += group.length
        for (const t of group) chunkFailedProductNos.add(t.naver_product_no)
        errors.push(`search 청크 실패(${searchRes.status}): ${originProductNos.join(",")}`)
        return
      }
      const searchData = (await searchRes.json()) as NaverSearchResponse
      const items = searchData.contents ?? []

      for (const item of items) {
        const productNo = String(item.originProductNo)
        const target = byProductNo.get(productNo)
        if (!target) continue // 대상 외(요청하지 않은 번호) 방어
        returnedProductNos.add(productNo)

        const cp = item.channelProducts?.[0]
        const statusType = cp?.statusType ?? ""

        if (statusType === "SALE") {
          const channelProductNo = cp?.channelProductNo
          if (channelProductNo != null) {
            saleProducts.push({ product: target, channelProductNo })
          } else {
            // SALE인데 channelProductNo 없음 → 상세 조회 불가, 격리 기록.
            failCount++
            errors.push(`${productNo}: SALE이나 channelProductNo 없음`)
          }
          continue
        }

        // 비-SALE(OUTOFSTOCK/SUSPENSION 등) → 전 옵션 품절 처리(오버셀 차단). 상품 status 유지.
        try {
          if (!dryRun && target.options.length > 0) {
            const optionIds = target.options.map((o) => o.id)
            const { error: stockErr } = await admin
              .from("product_options")
              .update({ stock: 0 })
              .in("id", optionIds)
            if (stockErr) throw stockErr
            changeWritten = true
          }
          successCount++
        } catch (e) {
          failCount++
          errors.push(`${productNo}: 품절 처리 실패 — ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    // 동시성 cap 단위 병렬 + wall-clock 예산. 카탈로그가 커도(645≈7청크) 60s 안에 바운드.
    // 예산 초과 시 미처리 청크 상품은 chunkFailedProductNos로 → HIDDEN 오판 금지(다음 회전 이월).
    for (let i = 0; i < searchChunks.length; i += SEARCH_CONCURRENCY) {
      if (Date.now() > deadlineMs) {
        for (const g of searchChunks.slice(i))
          for (const t of g) chunkFailedProductNos.add(t.naver_product_no)
        errors.push(`1단 예산 초과: ${searchChunks.length - i}개 청크 다음 회전 이월`)
        break
      }
      await Promise.all(
        searchChunks.slice(i, i + SEARCH_CONCURRENCY).map(processSearchChunk),
      )
    }

    // 검색에 반환되지 않은 대상(스토어 삭제) → status='HIDDEN'. ACTIVE 복원은 절대 안 함(수동 숨김 보존).
    phase = "stage1_hidden"
    for (const target of targets) {
      if (returnedProductNos.has(target.naver_product_no)) continue
      // 청크 실패로 미반환된 상품은 삭제 오판 금지(검색 성공했으나 결과 미포함 = 진짜 삭제만 HIDDEN).
      if (chunkFailedProductNos.has(target.naver_product_no)) continue
      try {
        if (!dryRun) {
          const { error: hideErr } = await admin
            .from("products")
            .update({ status: "HIDDEN" })
            .eq("id", target.id)
          if (hideErr) throw hideErr
          changeWritten = true
        }
        successCount++
      } catch (e) {
        failCount++
        errors.push(
          `${target.naver_product_no}: HIDDEN 처리 실패 — ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }

    // ── 2단(SALE 상세, per-product, 예산 회전) ────────────────────────────────
    // SALE 상품에 한해 상세 조회 → optionCombinations 재고를 product_options.naver_option_id 매칭 갱신.
    // 옵션이 없으면 originProduct.stockQuantity로 단일 기본옵션 갱신.
    // 동시성 cap 병렬 + wall-clock 예산 + 1회 CAP. 초과분은 다음 회전이 처리(건별 try/catch 격리).
    phase = "stage2_detail"
    let detailProcessed = 0
    const detailTargets = saleProducts.slice(0, DETAIL_CAP)

    const syncOne = async (entry: {
      product: TargetProduct
      channelProductNo: number
    }): Promise<number> => {
      try {
        const detailRes = await naverFetch(
          `${NAVER_API_BASE}/v2/products/channel-products/${entry.channelProductNo}`,
          {},
          token,
        )
        if (!detailRes.ok) {
          throw new Error(`상세 조회 실패(${detailRes.status})`)
        }
        const detail = (await detailRes.json()) as NaverChannelProductDetail
        const op = detail.originProduct
        const optionInfo = op?.detailAttribute?.optionInfo
        const combinations =
          optionInfo?.optionCombinations ?? optionInfo?.optionStandards ?? []

        if (combinations.length > 0) {
          // 네이버 옵션 id → 재고 매핑.
          const stockByNaverId = new Map<string, number>()
          for (const c of combinations) {
            if (c.id != null) stockByNaverId.set(String(c.id), c.stockQuantity ?? 0)
          }
          // naver_option_id 매칭분 stock 갱신. 네이버 콤비네이션에서 사라진 옵션(매칭 id 미반환)은
          // 품절 처리(오버셀 차단). naver_option_id 없는 자사몰 전용 옵션은 미터치.
          for (const opt of entry.product.options) {
            if (!opt.naver_option_id) continue
            const newStock = stockByNaverId.get(opt.naver_option_id) ?? 0
            if (!dryRun) {
              const { error: updErr } = await admin
                .from("product_options")
                .update({ stock: newStock })
                .eq("id", opt.id)
              if (updErr) throw updErr
              changeWritten = true
            }
          }
        } else {
          // 옵션 없음(단일 기본옵션) → originProduct.stockQuantity로 모든 옵션 갱신.
          const defaultStock = op?.stockQuantity ?? 0
          if (!dryRun && entry.product.options.length > 0) {
            const optionIds = entry.product.options.map((o) => o.id)
            const { error: updErr } = await admin
              .from("product_options")
              .update({ stock: defaultStock })
              .in("id", optionIds)
            if (updErr) throw updErr
            changeWritten = true
          }
        }
        return 1
      } catch (err) {
        // 건별 격리: 한 상품 실패가 회전 전체를 멈추지 않게. dead-letter로 Sentry.
        Sentry.captureException(err, {
          tags: { type: "naver.sync", phase: "stage2_detail_item" },
          extra: { naverProductNo: entry.product.naver_product_no },
        })
        failCount++
        errors.push(
          `${entry.product.naver_product_no}: 상세 동기화 실패 — ${err instanceof Error ? err.message : String(err)}`,
        )
        return 0
      }
    }

    for (let i = 0; i < detailTargets.length; i += DETAIL_CONCURRENCY) {
      if (Date.now() > deadlineMs) break // 예산 초과 → 남은 SALE 상세는 다음 회전.
      const slice = detailTargets.slice(i, i + DETAIL_CONCURRENCY)
      const results = await Promise.all(slice.map(syncOne))
      const ok = results.reduce((sum, n) => sum + n, 0)
      successCount += ok
      detailProcessed += slice.length
    }

    // ── sync_log 기록 + 캐시 무효화 ──────────────────────────────────────────
    phase = "finalize"
    const status: "SUCCESS" | "PARTIAL" | "FAILED" =
      failCount === 0 ? "SUCCESS" : successCount === 0 ? "FAILED" : "PARTIAL"

    if (!dryRun) {
      await admin.from("naver_sync_logs").insert({
        sync_type: "STOCK_SYNC",
        status,
        total_count: totalCount,
        success_count: successCount,
        fail_count: failCount,
        error_details: errors.length > 0 ? { errors } : null,
      })
      // stock/status 변경이 한 건이라도 있으면 목록/PDP 캐시(lib/products·product-detail) 무효화.
      if (changeWritten) revalidateTag("products")
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      status,
      total: totalCount,
      success: successCount,
      fail: failCount,
      saleProducts: saleProducts.length,
      detailProcessed,
      errors,
    })
  } catch (err) {
    // pg_net 재시도 폭주 방지 → 500 대신 HTTP 200 + {ok:false}. 관측은 Sentry + sync_log error.
    Sentry.captureException(err, { tags: { type: "naver.sync", phase } })
    const message = err instanceof Error ? err.message : String(err)
    if (!dryRun) {
      // 치명 실패도 이력에 남김(FAILED). insert 자체 실패는 무시(이미 상위 에러).
      await admin
        .from("naver_sync_logs")
        .insert({
          sync_type: "STOCK_SYNC",
          status: "FAILED",
          total_count: totalCount,
          success_count: successCount,
          fail_count: failCount,
          error_details: { errors: [...errors, message] },
        })
        .then(
          () => {},
          () => {},
        )
    }
    return NextResponse.json({ ok: false, error: message })
  }
}

// soft-lock 생략: naver_sync_logs에는 in_progress 상태가 없고(CHECK: SUCCESS/PARTIAL/FAILED),
// 매시간 cron + wall-clock 예산(40s)으로 invocation 겹침 가능성이 미미하다(gsc-sync처럼 락 행을
// 둘 별도 status 컬럼이 없으므로 도입하지 않음). 중복 실행 시에도 stock=값 멱등 갱신이라 안전.
//
// pg_net 및 수동 점검 모두 POST. 이 경로는 CSRF 면제이므로 상태 변경 액션을 GET으로 노출하지 않는다
// (안전 메서드만 허용 — 면제 경로의 부작용 GET 방지). 인증은 Bearer CRON_SECRET.
export const POST = handler
