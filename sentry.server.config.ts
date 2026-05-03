import * as Sentry from "@sentry/nextjs"

import { sanitizeEvent } from "@/lib/sentry/before-send"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  enableLogs: false,
  sendDefaultPii: false,
  debug: false,
  beforeSend: sanitizeEvent,
})
