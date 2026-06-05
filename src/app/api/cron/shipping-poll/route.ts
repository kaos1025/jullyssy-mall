import { NextRequest, NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getShippingTracker,
  UnsupportedCourierError,
} from "@/lib/shipping/tracker"
import { markOrderDelivered } from "@/lib/order/markOrderDelivered"

// Node 런타임 고정(default). createAdminClient(service role) + 외부 HTTP 폴링 + Sentry(Node)를
// 한 런타임에서. 캐시 금지(매 실행 신규 조회).
export const dynamic = "force-dynamic"
export const maxDuration = 60

// 무료 쿼터 보호 — 1회 폴링 최대 건수 + 동시성 cap.
// 40건 / 동시 8 = 5웨이브, all-timeout(8s) 최악도 ~40s < maxDuration(60s).
const BATCH_CAP = 40
const CONCURRENCY = 8

// pg_cron + pg_net이 vault 'shipping_poll_auth' Bearer로 호출. 인바운드 인증.
const isAuthorized = (request: NextRequest): boolean => {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

type PollOutcome =
  | "transitioned"
  | "skipped"
  | "unsupported"
  | "failed"

interface PollTarget {
  id: string
  courier: string | null
  tracking_no: string | null
}

const handler = async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // ?dryRun=1 — 판정·집계만, 전환/메일 skip. 활성화 전 전건 프리뷰(0 고객영향)로
  // 실데이터 판정을 전수 대조하는 필수 게이트 + 운영 중 현재 판정 재확인용 상시 디버그 도구.
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"

  const admin = createAdminClient()
  const tracker = getShippingTracker()

  // 대상: 배송중 + 송장 보유. 오래 머문 SHIPPING부터(shipped_at asc, NULL 우선) cap만큼.
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, courier, tracking_no")
    .eq("status", "SHIPPING")
    .not("tracking_no", "is", null)
    .order("shipped_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_CAP)

  if (error) {
    Sentry.captureException(error, {
      tags: { type: "shipping.auto_complete", phase: "query" },
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const targets = (orders ?? []) as PollTarget[]

  const processOne = async (
    order: PollTarget
  ): Promise<{ outcome: PollOutcome; deliveredAt: Date | null }> => {
    if (!order.courier || !order.tracking_no)
      return { outcome: "skipped", deliveredAt: null }
    try {
      const result = await tracker.fetchStatus(order.courier, order.tracking_no)
      if (!result.delivered) return { outcome: "skipped", deliveredAt: null }

      // dryRun: 전환·메일 없이 "전환 대상"으로만 표시(불가역 액션 0). 실 모드만 SSOT 경유.
      if (dryRun)
        return { outcome: "transitioned", deliveredAt: result.deliveredAt }

      const mark = await markOrderDelivered(admin, order.id, {
        via: "SYSTEM",
        deliveredAt: result.deliveredAt,
        guardStatus: "SHIPPING",
      })
      if (mark.status === "transitioned")
        return { outcome: "transitioned", deliveredAt: result.deliveredAt }
      if (mark.status === "skipped")
        return { outcome: "skipped", deliveredAt: null }
      Sentry.captureMessage(`자동완료 UPDATE 실패: ${mark.error}`, {
        level: "error",
        tags: { type: "shipping.auto_complete", phase: "update" },
        extra: { orderId: order.id },
      })
      return { outcome: "failed", deliveredAt: null }
    } catch (err) {
      // 미지원 택배사는 시스템 오류 아님 → Sentry 없이 skip.
      if (err instanceof UnsupportedCourierError)
        return { outcome: "unsupported", deliveredAt: null }
      // 건별 격리: 한 건 실패가 배치 전체를 멈추지 않게 + dead-letter로 Sentry.
      Sentry.captureException(err, {
        tags: { type: "shipping.auto_complete", phase: "fetch" },
        extra: { orderId: order.id, courier: order.courier },
      })
      return { outcome: "failed", deliveredAt: null }
    }
  }

  const tally: Record<PollOutcome, number> = {
    transitioned: 0,
    skipped: 0,
    unsupported: 0,
    failed: 0,
  }
  // dryRun 프리뷰: 전환 대상(=실 모드면 자동완료+메일될 건)을 전수 대조용으로 노출.
  const wouldTransition: {
    id: string
    courier: string | null
    deliveredAt: string | null
  }[] = []

  // 동시성 cap 단위로 순차 진행 → 외부 API 폭주 방지 + wall-clock 상한.
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (order) => ({ order, ...(await processOne(order)) }))
    )
    for (const r of results) {
      tally[r.outcome] += 1
      if (dryRun && r.outcome === "transitioned") {
        wouldTransition.push({
          id: r.order.id,
          courier: r.order.courier,
          deliveredAt: r.deliveredAt?.toISOString() ?? null,
        })
      }
    }
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      polled: targets.length,
      wouldTransition,
      skipped: tally.skipped,
      unsupported: tally.unsupported,
      failed: tally.failed,
    })
  }

  return NextResponse.json({ ok: true, polled: targets.length, ...tally })
}

// pg_net 및 수동 점검 모두 POST. 이 경로는 CSRF 면제이므로 상태 변경 액션을 GET으로 노출하지 않는다
// (안전 메서드만 허용 — 면제 경로의 부작용 GET 방지). 인증은 Bearer CRON_SECRET.
export const POST = handler
