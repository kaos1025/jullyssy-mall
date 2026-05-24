import * as Sentry from "@sentry/nextjs"
import { render } from "@react-email/render"
import type { ReactElement } from "react"

import { getResendClient } from "@/lib/email/client"

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
    })
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email:${opts.event}] send failed (fire-and-forget):`, err)
    }
  })
}
