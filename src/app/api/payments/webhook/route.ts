import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"

const maskKey = (key: string): string => {
  if (key.length <= 8) return "***"
  return `${key.slice(0, 4)}***${key.slice(-4)}`
}

export const POST = async (request: Request) => {
  const body = await request.json()
  const { eventType, data } = body ?? {}

  // 미처리 eventType은 silent ignore (재시도 폭주 방지)
  if (eventType !== "PAYMENT_STATUS_CHANGED") {
    console.log(`[webhook] ignoring eventType: ${eventType}`)
    return NextResponse.json({ success: true, ignored: true })
  }

  const incomingPaymentKey = data?.paymentKey as string | undefined
  const incomingSecret = data?.secret as string | undefined
  const incomingStatus = data?.status as string | undefined

  if (!incomingPaymentKey || !incomingSecret) {
    console.warn("[webhook] missing paymentKey or secret in body")
    // TODO(rate-limit-rebase): replace with Sentry.captureMessage("webhook_verify_fail", { level: "warning", tags: { reason: "missing_fields" } })
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 401 })
  }

  const admin = createAdminClient()

  // payment_key로 row lookup (검증용 secret + 후속 update용 order_id 동시 획득)
  const { data: payment, error } = await admin
    .from("payments")
    .select("secret, order_id")
    .eq("payment_key", incomingPaymentKey)
    .single()

  if (error || !payment) {
    console.warn(`[webhook] payment not found: ${maskKey(incomingPaymentKey)}`)
    // TODO(rate-limit-rebase): replace with Sentry.captureMessage("webhook_verify_fail", { level: "warning", tags: { reason: "not_found" } })
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 401 })
  }

  if (!payment.secret) {
    console.warn(`[webhook] payment.secret is null: ${maskKey(incomingPaymentKey)}`)
    // TODO(rate-limit-rebase): replace with Sentry.captureMessage("webhook_verify_fail", { level: "warning", tags: { reason: "null_secret" } })
    return NextResponse.json({ error: "UNVERIFIED" }, { status: 401 })
  }

  // timingSafeEqual은 같은 길이 Buffer 요구 — 길이 불일치 시 즉시 401
  const storedBuf = Buffer.from(payment.secret, "utf8")
  const incomingBuf = Buffer.from(incomingSecret, "utf8")

  if (storedBuf.length !== incomingBuf.length) {
    console.warn(`[webhook] secret length mismatch: ${maskKey(incomingPaymentKey)}`)
    // TODO(rate-limit-rebase): replace with Sentry.captureMessage("webhook_verify_fail", { level: "warning", tags: { reason: "length_mismatch" } })
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  if (!timingSafeEqual(storedBuf, incomingBuf)) {
    console.warn(`[webhook] secret mismatch: ${maskKey(incomingPaymentKey)}`)
    // TODO(rate-limit-rebase): replace with Sentry.captureMessage("webhook_verify_fail", { level: "warning", tags: { reason: "secret_mismatch" } })
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  // 검증 통과 → 기존 update 로직 진행
  await admin
    .from("payments")
    .update({
      status: incomingStatus === "DONE" ? "DONE" : incomingStatus,
      raw_response: data,
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
