import type { ErrorEvent } from "@sentry/nextjs"

const SENSITIVE_REQUEST_KEYS = [
  "password",
  "phone",
  "phone_number",
  "recipient_phone",
  "address",
  "detail_address",
  "zonecode",
  "birth",
  "birthday",
  "card_number",
  "cvc",
  "cardNumber",
  "payment_key",
  "paymentKey",
  "secret",
]

const SENSITIVE_HEADERS = ["cookie", "set-cookie", "authorization"]

const SENSITIVE_QUERY_PATTERN = /(paymentKey|orderId|amount|secret)=[^&]*/gi

export function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  const req = event.request
  if (req) {
    if (req.cookies) {
      delete req.cookies
    }
    if (req.headers) {
      for (const header of SENSITIVE_HEADERS) {
        delete req.headers[header]
      }
    }
    if (req.data && typeof req.data === "object") {
      const data = req.data as Record<string, unknown>
      for (const key of SENSITIVE_REQUEST_KEYS) {
        if (key in data) data[key] = "[REDACTED]"
      }
    }
    if (typeof req.query_string === "string") {
      req.query_string = req.query_string.replace(
        SENSITIVE_QUERY_PATTERN,
        "$1=[REDACTED]"
      )
    }
  }
  if (event.user?.email) {
    event.user.email = "[email-redacted]"
  }
  return event
}
