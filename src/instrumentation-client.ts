import * as Sentry from "@sentry/nextjs"

import { sanitizeEvent } from "@/lib/sentry/before-send"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    "development",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  enableLogs: false,
  sendDefaultPii: false,
  debug: true,
  beforeSend: sanitizeEvent,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "AbortError",
    "NetworkError when attempting to fetch resource",
    /Loading chunk \d+ failed/,
    /Failed to fetch dynamically imported module/,
    /USER_CANCEL/,
    /PAY_PROCESS_CANCELED/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
