import { describe, it, expect } from "vitest"
import type { NextRequest } from "next/server"
import { isCsrfExempt, verifyCsrf } from "./csrf"

const req = (method: string, pathname: string) =>
  ({
    method,
    nextUrl: { pathname },
    headers: { get: () => null },
  }) as unknown as NextRequest

describe("isCsrfExempt", () => {
  it("cron 라우트는 면제 (외부 pg_net POST, Origin 없음, Bearer 보호)", () => {
    expect(isCsrfExempt("/api/cron/shipping-poll")).toBe(true)
  })
  it("기존 면제(webhook/dev) 유지", () => {
    expect(isCsrfExempt("/api/payments/webhook")).toBe(true)
    expect(isCsrfExempt("/api/dev/send-test")).toBe(true)
  })
  it("일반 API는 비면제", () => {
    expect(isCsrfExempt("/api/orders")).toBe(false)
    expect(isCsrfExempt("/api/admin/orders/x")).toBe(false)
  })
  it("등록 안 된 cron 경로는 비면제 (경로별 명시 원칙)", () => {
    expect(isCsrfExempt("/api/cron/other-job")).toBe(false)
  })
})

describe("verifyCsrf", () => {
  // 면제 경로는 env/Origin과 무관하게 통과(line: isCsrfExempt가 enforce 체크보다 먼저).
  it("cron POST는 면제로 통과 (403 CSRF_FAILED 해소)", () => {
    expect(verifyCsrf(req("POST", "/api/cron/shipping-poll"))).toEqual({
      ok: true,
    })
  })
  // 비상태변경(GET)은 항상 통과 — env 비의존.
  it("GET은 검사 대상 아님", () => {
    expect(verifyCsrf(req("GET", "/api/orders"))).toEqual({ ok: true })
  })
})
