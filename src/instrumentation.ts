import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { validateEnv } = await import("@/lib/env")
      validateEnv()
    } catch (err) {
      console.error("[instrumentation] validateEnv failed:", err)
    }

    await import("../sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
