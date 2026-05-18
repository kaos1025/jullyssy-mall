// PHASE-2-DIAG: 격리 테스트 — onRequestError와 함께 일시 주석 (NEXT-REDIRECT-SWALLOW-1)
// import * as Sentry from "@sentry/nextjs"

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

// PHASE-2-DIAG: 격리 테스트로 일시 비활성화 (NEXT-REDIRECT-SWALLOW-1)
// export const onRequestError = Sentry.captureRequestError
