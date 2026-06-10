import * as Sentry from "@sentry/nextjs"
import { render } from "@react-email/render"
import { createElement, type ReactElement } from "react"

import { getResendClient } from "@/lib/email/client"
import {
  OrderConfirmation,
  type OrderConfirmationProps,
} from "@/lib/email/templates/OrderConfirmation"
import {
  ClaimApproved,
  type ClaimApprovedProps,
} from "@/lib/email/templates/ClaimApproved"
import {
  ClaimRejected,
  type ClaimRejectedProps,
} from "@/lib/email/templates/ClaimRejected"
import {
  RefundCompleted,
  type RefundCompletedProps,
} from "@/lib/email/templates/RefundCompleted"
import {
  ShippingDelivered,
  type ShippingDeliveredProps,
} from "@/lib/email/templates/ShippingDelivered"
import {
  ShippingStarted,
  type ShippingStartedProps,
} from "@/lib/email/templates/ShippingStarted"

export type SendEmailOptions = {
  /** 도메인 이벤트명 (Sentry tag 'event'). 예: 'order_paid', 'cancel_confirm' */
  event: string
  /** 수신자. 단일 또는 복수 */
  to: string | string[]
  /** 제목 */
  subject: string
  /** React Email 템플릿 엘리먼트 (send.ts 내부에서 render) */
  react: ReactElement
  /** 발신자 override. 미지정 시 process.env.EMAIL_FROM 사용 */
  from?: string
  /** 실패 시 Sentry extra로 함께 전송될 도메인 컨텍스트 (orderId 등) */
  context?: Record<string, unknown>
}

/**
 * 동기 send — 호출부가 결과를 알아야 할 때 사용.
 * 누락된 env / Resend 응답 error 모두 throw.
 * 결제 critical path에서는 sendAsync 사용 권장.
 */
export async function send(opts: SendEmailOptions) {
  const from = opts.from ?? process.env.EMAIL_FROM
  if (!from) {
    throw new Error("EMAIL_FROM env 누락 — send.ts runtime guard")
  }
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY env 누락 — send.ts runtime guard")
  }
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to]
  if (recipients.length === 0 || recipients.some((r) => !r)) {
    throw new Error("send.ts: 'to' 누락")
  }

  const html = await render(opts.react)
  const text = await render(opts.react, { plainText: true })

  const { data, error } = await getResendClient().emails.send({
    from,
    to: recipients,
    subject: opts.subject,
    html,
    text,
  })

  if (error) {
    const err = new Error(`Resend send failed: ${error.name} — ${error.message}`)
    ;(err as Error & { resendError?: unknown }).resendError = error
    throw err
  }

  return data
}

/**
 * fire-and-forget wrapper — 결제/주문 critical path 권장.
 * await 금지 (호출부에서 .then/.catch 없이 호출 가능).
 * 실패 시 Sentry warning + dev console.warn.
 */
export function sendAsync(opts: SendEmailOptions): void {
  send(opts).catch((err: unknown) => {
    Sentry.captureException(err, {
      level: "warning",
      tags: {
        type: "email",
        event: opts.event,
        env: process.env.VERCEL_ENV ?? "local",
      },
      extra: opts.context,
    })
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email:${opts.event}] send failed (fire-and-forget):`, err)
    }
  })
}

// =============================================================================
// Production wrappers — 4종 호출부 통합용 (Phase 3)
// =============================================================================
// 각 wrapper는 sendAsync 기반 (fire-and-forget). 호출부에서 await/try-catch 금지.
// Day 18 결제 라이프사이클 무결성 — 메일 발송 실패가 결제 응답을 차단하지 않도록.

const PRODUCTION_SUBJECTS = {
  orderConfirmation: "[쥴리씨] 주문 확정 안내",
  shippingStarted: "[쥴리씨] 상품 출고 안내",
  shippingDelivered: "[쥴리씨] 배송 완료 안내",
  refundCompleted: "[쥴리씨] 환불 완료 안내",
  claimApproved: "[쥴리씨] 반품/교환 승인 안내",
  claimRejected: "[쥴리씨] 반품/교환 반려 안내",
} as const

export type SendContext = { context?: Record<string, unknown> }

export const sendOrderConfirmation = (
  params: { to: string | string[] } & OrderConfirmationProps & SendContext
): void => {
  const { to, context, ...props } = params
  sendAsync({
    event: "order_confirmation",
    to,
    subject: PRODUCTION_SUBJECTS.orderConfirmation,
    react: createElement(OrderConfirmation, props),
    context,
  })
}

export const sendShippingStarted = (
  params: { to: string | string[] } & ShippingStartedProps & SendContext
): void => {
  const { to, context, ...props } = params
  sendAsync({
    event: "shipping_started",
    to,
    subject: PRODUCTION_SUBJECTS.shippingStarted,
    react: createElement(ShippingStarted, props),
    context,
  })
}

export const sendShippingDelivered = (
  params: { to: string | string[] } & ShippingDeliveredProps & SendContext
): void => {
  const { to, context, ...props } = params
  sendAsync({
    event: "shipping_delivered",
    to,
    subject: PRODUCTION_SUBJECTS.shippingDelivered,
    react: createElement(ShippingDelivered, props),
    context,
  })
}

export const sendRefundCompleted = (
  params: { to: string | string[] } & RefundCompletedProps & SendContext
): void => {
  const { to, context, ...props } = params
  sendAsync({
    event: "refund_completed",
    to,
    subject: PRODUCTION_SUBJECTS.refundCompleted,
    react: createElement(RefundCompleted, props),
    context,
  })
}

export const sendClaimApproved = (
  params: { to: string | string[] } & ClaimApprovedProps & SendContext
): void => {
  const { to, context, ...props } = params
  sendAsync({
    event: "claim_approved",
    to,
    subject: PRODUCTION_SUBJECTS.claimApproved,
    react: createElement(ClaimApproved, props),
    context,
  })
}

export const sendClaimRejected = (
  params: { to: string | string[] } & ClaimRejectedProps & SendContext
): void => {
  const { to, context, ...props } = params
  sendAsync({
    event: "claim_rejected",
    to,
    subject: PRODUCTION_SUBJECTS.claimRejected,
    react: createElement(ClaimRejected, props),
    context,
  })
}
