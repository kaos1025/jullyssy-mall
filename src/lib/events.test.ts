import { describe, it, expect, vi, beforeEach } from "vitest"

// 공개 이벤트 카테고리 fetcher(getActiveEventCategories) 단위 테스트 — (shop)/layout의 dynamic 원인 제거 회귀 방지.
// 고정하는 것: cookies 기반 server client 미사용(ISR 유지), service_role 보상 필터(is_active + 기간), 에러 → [].

type Call = { method: string; args: unknown[] }

const { createAdminClient, createServerClient, builders, setResponse } = vi.hoisted(() => {
  const builders: { table: string; calls: Call[] }[] = []
  let response: { data: unknown; error: { message: string } | null } = { data: [], error: null }
  const setResponse = (r: typeof response) => {
    response = r
  }
  const makeBuilder = (table: string) => {
    const calls: Call[] = []
    builders.push({ table, calls })
    const b: Record<string, unknown> = {}
    for (const m of ["select", "eq", "or", "order"]) {
      b[m] = vi.fn((...args: unknown[]) => {
        calls.push({ method: m, args })
        return b
      })
    }
    b.then = (onFulfilled: (v: typeof response) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(response).then(onFulfilled, onRejected)
    return b
  }
  return {
    builders,
    setResponse,
    createAdminClient: vi.fn(() => ({ from: vi.fn((table: string) => makeBuilder(table)) })),
    // 공개 fetcher가 cookies 기반 클라이언트로 회귀하면 즉시 실패하도록 throw
    createServerClient: vi.fn(() => {
      throw new Error("cookies-based client must not be used in cached public fetcher")
    }),
  }
})

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@/lib/supabase/server", () => ({ createClient: createServerClient }))

import { getActiveEventCategories } from "./events"

const callsOf = (b: { calls: Call[] }, method: string) =>
  b.calls.filter((c) => c.method === method).map((c) => c.args)

beforeEach(() => {
  builders.length = 0
  setResponse({ data: [], error: null })
  createAdminClient.mockClear()
  createServerClient.mockClear()
})

describe("getActiveEventCategories (캐시 격리 공개 fetcher)", () => {
  it("admin client + is_active/기간 필터 + display_order 정렬, 데이터 반환", async () => {
    setResponse({ data: [{ id: "e1" }], error: null })

    const result = await getActiveEventCategories()

    expect(result.map((e) => e.id)).toEqual(["e1"])
    expect(createServerClient).not.toHaveBeenCalled()
    expect(createAdminClient).toHaveBeenCalledTimes(1)
    expect(builders).toHaveLength(1)
    expect(builders[0].table).toBe("event_categories")
    expect(callsOf(builders[0], "select")).toEqual([["*"]])
    expect(callsOf(builders[0], "eq")).toEqual([["is_active", true]])
    const ors = callsOf(builders[0], "or").map((a) => a[0] as string)
    expect(ors).toHaveLength(2)
    expect(ors[0]).toMatch(/^starts_at\.is\.null,starts_at\.lte\./)
    expect(ors[1]).toMatch(/^ends_at\.is\.null,ends_at\.gte\./)
    expect(callsOf(builders[0], "order")).toEqual([["display_order", { ascending: true }]])
  })

  it("쿼리 에러 → [] (throw 안 함, 레이아웃 graceful degrade)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    setResponse({ data: null, error: { message: "boom" } })

    await expect(getActiveEventCategories()).resolves.toEqual([])
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("data null → []", async () => {
    setResponse({ data: null, error: null })
    await expect(getActiveEventCategories()).resolves.toEqual([])
  })
})
