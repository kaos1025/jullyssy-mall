import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

export const dynamic = "force-dynamic"

export async function GET() {
  const client = Sentry.getClient()
  return NextResponse.json({
    env_dsn_present: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    env_dsn_prefix: (process.env.NEXT_PUBLIC_SENTRY_DSN || "").slice(0, 30),
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV,
    sdk_client_initialized: !!client,
    sdk_options_dsn_set: !!client?.getOptions().dsn,
    sdk_options_enabled: client?.getOptions().enabled,
  })
}
