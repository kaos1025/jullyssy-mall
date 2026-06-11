import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { withRateLimit } from "@/lib/api-helpers/withRateLimit"
import { paymentsLimiter } from "@/lib/rate-limit/limiters"
import { getTossPayment, type TossPayment } from "@/lib/payment/toss-cancel"
import { cancelOrder } from "@/lib/order/cancel-order"
import type { Json } from "@/types/supabase"

const maskKey = (key: string): string => {
  if (key.length <= 8) return "***"
  return `${key.slice(0, 4)}***${key.slice(-4)}`
}

type AdminClient = ReturnType<typeof createAdminClient>
type WebhookData = Record<string, unknown>

// ============================================================
// PAYMENT_STATUS_CHANGED — 기존 거동 보존 (가상계좌 입금확인 등).
// per-payment secret(timingSafeEqual) 검증. 기존 TODO 주석을 Sentry.captureMessage로 교체(검증 로직 불변, 로깅만).
// ============================================================
const handlePaymentStatusChanged = async (
  admin: AdminClient,
  data: WebhookData
): Promise<NextResponse> => {
  const incomingPaymentKey = data.paymentKey as string | undefined
  const incomingSecret = data.secret as string | undefined
  const incomingStatus = data.status as string | undefined

  if (!incomingPaymentKey || !incomingSecret) {
    Sentry.captureMessage("webhook_verify_fail", {
      level: "warning",
      tags: { reason: "missing_fields" },
    })
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 401 })
  }

  // payment_key로 row lookup (검증용 secret + 후속 update용 order_id 동시 획득)
  const { data: payment, error } = await admin
    .from("payments")
    .select("secret, order_id")
    .eq("payment_key", incomingPaymentKey)
    .single()

  if (error || !payment) {
    Sentry.captureMessage("webhook_verify_fail", {
      level: "warning",
      tags: { reason: "not_found" },
      extra: { paymentKey: maskKey(incomingPaymentKey) },
    })
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 401 })
  }

  if (!payment.secret) {
    Sentry.captureMessage("webhook_verify_fail", {
      level: "warning",
      tags: { reason: "null_secret" },
      extra: { paymentKey: maskKey(incomingPaymentKey) },
    })
    return NextResponse.json({ error: "UNVERIFIED" }, { status: 401 })
  }

  // timingSafeEqual은 같은 길이 Buffer 요구 — 길이 불일치 시 즉시 401
  const storedBuf = Buffer.from(payment.secret, "utf8")
  const incomingBuf = Buffer.from(incomingSecret, "utf8")

  if (storedBuf.length !== incomingBuf.length) {
    Sentry.captureMessage("webhook_verify_fail", {
      level: "warning",
      tags: { reason: "length_mismatch" },
      extra: { paymentKey: maskKey(incomingPaymentKey) },
    })
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  if (!timingSafeEqual(storedBuf, incomingBuf)) {
    Sentry.captureMessage("webhook_verify_fail", {
      level: "warning",
      tags: { reason: "secret_mismatch" },
      extra: { paymentKey: maskKey(incomingPaymentKey) },
    })
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  // 검증 통과 → 기존 update 로직 진행
  await admin
    .from("payments")
    .update({
      status: incomingStatus === "DONE" ? "DONE" : incomingStatus,
      raw_response: data as Json,
    })
    .eq("payment_key", incomingPaymentKey)

  // 입금확인 (가상계좌) — DONE 시에만 orders.status='PAID' 처리
  if (incomingStatus === "DONE") {
    await admin
      .from("orders")
      .update({ status: "PAID" })
      .eq("id", payment.order_id)
  }

  return NextResponse.json({ success: true })
}

// ============================================================
// CANCEL_STATUS_CHANGED — P1-16 spec §4.
//
// 검증(런타임 이중 경로 — PM 지시, 택일 아님):
//   payload에 per-payment secret 존재 → timingSafeEqual / 부재 → 토스 역조회로 실제 취소 상태 실검증.
//   두 경로 모두 실패 시 거부 (검증 없는 수용 금지). 어느 경로가 탔는지 breadcrumb 기록 →
//   US-014 실 부분취소 1건으로 실경로 확정 후 미사용 경로 제거 여부는 P2.
//
// 분기(검증 통과 후, payments.status로 자사발/외부발 판별):
//   1) 이미 CANCELLED/PARTIAL_CANCELLED = 자사 클레임/취소 플로우 동기화 완료 → no-op 멱등
//   2) DONE + 전액(토스 잔액 0) = 토스 콘솔 직접 취소 → cancelOrder(skipTossCancel) DB 동기화
//   3) DONE + 부분(또는 잔액 불확실) = 자동 동기화 제외, payments=PARTIAL_CANCELLED + Sentry warning(수동 정합)
// ============================================================
type CancelVerifyResult =
  | { ok: true; via: "secret"; tossPayment: null }
  | { ok: true; via: "reverse_lookup"; tossPayment: TossPayment }
  | { ok: false; reason: string; status: number }

const verifyCancelEvent = async (
  paymentSecret: string | null,
  incomingPaymentKey: string,
  incomingSecret: string | undefined
): Promise<CancelVerifyResult> => {
  // 경로 1: payload에 per-payment secret 존재 → 기존 timingSafeEqual 검증
  if (incomingSecret) {
    if (!paymentSecret) return { ok: false, reason: "null_secret", status: 401 }
    const storedBuf = Buffer.from(paymentSecret, "utf8")
    const incomingBuf = Buffer.from(incomingSecret, "utf8")
    if (
      storedBuf.length === incomingBuf.length &&
      timingSafeEqual(storedBuf, incomingBuf)
    ) {
      Sentry.addBreadcrumb({
        category: "webhook.cancel.verify",
        level: "info",
        message: "verified via secret",
        data: { path: "secret", paymentKey: maskKey(incomingPaymentKey) },
      })
      return { ok: true, via: "secret", tossPayment: null }
    }
    return { ok: false, reason: "secret_mismatch", status: 401 }
  }

  // 경로 2: secret 미제공 → paymentKey로 토스 역조회, 실제 취소 상태로 실검증 (검증 없는 수용 금지)
  const lookup = await getTossPayment(incomingPaymentKey)
  if (!lookup.ok) {
    return {
      ok: false,
      reason: `reverse_lookup_failed:${lookup.httpStatus}`,
      status: 401,
    }
  }
  const tossStatus = lookup.payment.status
  if (tossStatus !== "CANCELED" && tossStatus !== "PARTIAL_CANCELED") {
    return {
      ok: false,
      reason: `reverse_lookup_status_mismatch:${tossStatus ?? "unknown"}`,
      status: 401,
    }
  }
  Sentry.addBreadcrumb({
    category: "webhook.cancel.verify",
    level: "info",
    message: "verified via reverse lookup",
    data: {
      path: "reverse_lookup",
      paymentKey: maskKey(incomingPaymentKey),
      tossStatus,
    },
  })
  return { ok: true, via: "reverse_lookup", tossPayment: lookup.payment }
}

const handleCancelStatusChanged = async (
  admin: AdminClient,
  data: WebhookData
): Promise<NextResponse> => {
  const incomingPaymentKey = data.paymentKey as string | undefined
  const incomingSecret = data.secret as string | undefined

  if (!incomingPaymentKey) {
    Sentry.captureMessage("webhook_cancel_verify_fail", {
      level: "warning",
      tags: { reason: "missing_payment_key" },
    })
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 401 })
  }

  const { data: payment, error } = await admin
    .from("payments")
    .select("secret, order_id, status")
    .eq("payment_key", incomingPaymentKey)
    .single()

  if (error || !payment) {
    Sentry.captureMessage("webhook_cancel_verify_fail", {
      level: "warning",
      tags: { reason: "not_found" },
      extra: { paymentKey: maskKey(incomingPaymentKey) },
    })
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 401 })
  }

  // ── 검증: 런타임 이중 경로 ──
  const verified = await verifyCancelEvent(
    payment.secret,
    incomingPaymentKey,
    incomingSecret
  )
  if (!verified.ok) {
    Sentry.captureMessage("webhook_cancel_verify_fail", {
      level: "warning",
      tags: { reason: verified.reason },
      extra: { paymentKey: maskKey(incomingPaymentKey) },
    })
    return NextResponse.json(
      { error: "UNAUTHORIZED" },
      { status: verified.status }
    )
  }

  // ── 시나리오 1: 자사 플로우가 이미 동기화 → no-op 멱등 ──
  if (payment.status === "CANCELLED" || payment.status === "PARTIAL_CANCELLED") {
    Sentry.addBreadcrumb({
      category: "webhook.cancel.sync",
      level: "info",
      data: { scenario: "noop", via: verified.via },
    })
    return NextResponse.json({ success: true, scenario: "noop" })
  }

  // ── 외부발 (payments.status=DONE) — 토스 실잔액으로 전액/부분 판별 (저장값 불신, 서버 권위) ──
  let tossPayment: TossPayment | null = verified.tossPayment
  if (!tossPayment) {
    const lookup = await getTossPayment(incomingPaymentKey)
    if (lookup.ok) tossPayment = lookup.payment
  }
  const balanceAmount = tossPayment?.balanceAmount

  if (balanceAmount === 0) {
    // ── 시나리오 2: 토스 콘솔 직접 전액취소 → cancelOrder DB 동기화 (토스 재호출 skip) ──
    const result = await cancelOrder(
      payment.order_id,
      {
        actor: "SYSTEM",
        reason: "OTHER",
        note: "토스 콘솔 직접 전액취소 webhook 동기화",
      },
      { skipTossCancel: true }
    )
    Sentry.addBreadcrumb({
      category: "webhook.cancel.sync",
      level: "info",
      data: { scenario: "full_sync", via: verified.via },
    })
    if ("error" in result) {
      // DB 동기화 실패 — 500으로 토스 재시도 유도(일시오류 복구) + Sentry로 영구오류 수동 개입
      Sentry.captureMessage("webhook_cancel_full_sync_fail", {
        level: "error",
        tags: { reason: "cancel_order_failed" },
        extra: { orderId: payment.order_id, error: result.error },
      })
      // 내부 에러 detail은 Sentry extra에만 — 응답 바디는 generic(토스는 바디 무시, 500이면 재시도)
      return NextResponse.json({ error: "sync_failed" }, { status: 500 })
    }
    return NextResponse.json({ success: true, scenario: "full_sync" })
  }

  // ── 시나리오 3: 부분 취소(또는 잔액 불확실) → 자동 동기화 제외, payments 갱신 + 수동 정합 ──
  await admin
    .from("payments")
    .update({ status: "PARTIAL_CANCELLED", raw_response: data as Json })
    .eq("payment_key", incomingPaymentKey)
  Sentry.addBreadcrumb({
    category: "webhook.cancel.sync",
    level: "warning",
    data: { scenario: "partial_manual", via: verified.via },
  })
  Sentry.captureMessage("webhook_cancel_partial_manual", {
    level: "warning",
    tags: { reason: "partial_cancel_manual_reconcile" },
    extra: {
      paymentKey: maskKey(incomingPaymentKey),
      orderId: payment.order_id,
      balanceAmount: balanceAmount ?? null,
    },
  })
  return NextResponse.json({ success: true, scenario: "partial_manual" })
}

const postHandler = async (request: Request) => {
  const body = await request.json()
  const { eventType, data } = body ?? {}
  const admin = createAdminClient()

  switch (eventType) {
    case "PAYMENT_STATUS_CHANGED":
      return handlePaymentStatusChanged(admin, (data ?? {}) as WebhookData)
    case "CANCEL_STATUS_CHANGED":
      return handleCancelStatusChanged(admin, (data ?? {}) as WebhookData)
    default:
      // 미처리 eventType은 silent ignore (재시도 폭주 방지)
      console.log(`[webhook] ignoring eventType: ${eventType}`)
      return NextResponse.json({ success: true, ignored: true })
  }
}

export const POST = withRateLimit(paymentsLimiter, postHandler)
