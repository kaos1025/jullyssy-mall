import { describe, it, expect, vi, beforeEach } from "vitest"

// 배너 이미지 best-effort 제거기 단위 테스트 — storage/Sentry 경계만 모킹.
const { createAdminClient, captureMessage, remove } = vi.hoisted(() => {
  const remove = vi.fn()
  return {
    remove,
    createAdminClient: vi.fn(() => ({ storage: { from: () => ({ remove }) } })),
    captureMessage: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }))
vi.mock("@sentry/nextjs", () => ({ captureMessage, captureException: vi.fn() }))

import {
  removeOldBannerObjectsByUrl,
  removeNewBannerObjectsByPath,
} from "./hero-banners"

const BASE = "https://abc.supabase.co/storage/v1/object/public/product-images/"

beforeEach(() => {
  remove.mockReset()
  captureMessage.mockClear()
})

describe("removeOldBannerObjectsByUrl (교체/삭제 후 OLD 제거)", () => {
  it("정상 banners/ URL → 해당 path remove (성공 시 Sentry 없음)", async () => {
    remove.mockResolvedValue({ data: [{}], error: null })
    await expect(
      removeOldBannerObjectsByUrl([
        BASE + "banners/1_pc.jpg",
        BASE + "banners/1_mobile.jpg",
      ])
    ).resolves.toBeUndefined()
    expect(remove).toHaveBeenCalledWith(["banners/1_pc.jpg", "banners/1_mobile.jpg"])
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it("storage 삭제 실패해도 throw 안 함 + Sentry hygiene 경고", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(
      removeOldBannerObjectsByUrl([BASE + "banners/1_pc.jpg"])
    ).resolves.toBeUndefined()
    expect(captureMessage).toHaveBeenCalledWith(
      "hero_banner_object_remove_failed",
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ kind: "hygiene" }),
      })
    )
  })

  it("banners/ 밖 URL은 스킵 + path_guard Sentry, remove에서 제외", async () => {
    remove.mockResolvedValue({ data: [{}], error: null })
    await removeOldBannerObjectsByUrl([BASE + "products/x.jpg", BASE + "banners/ok.jpg"])
    expect(captureMessage).toHaveBeenCalledWith(
      "hero_banner_orphan_path_guard",
      expect.objectContaining({ tags: expect.objectContaining({ kind: "hygiene" }) })
    )
    expect(remove).toHaveBeenCalledWith(["banners/ok.jpg"]) // products/ 제외
  })

  it("제거할 유효 path 없으면 remove 미호출", async () => {
    await removeOldBannerObjectsByUrl([null, undefined])
    expect(remove).not.toHaveBeenCalled()
  })
})

describe("removeNewBannerObjectsByPath (업로드~DB커밋 실패 시 신규 제거)", () => {
  it("path 직접 remove (URL 역산 없음)", async () => {
    remove.mockResolvedValue({ data: [{}], error: null })
    await removeNewBannerObjectsByPath(["banners/new_pc.jpg", "banners/new_mobile.jpg"])
    expect(remove).toHaveBeenCalledWith(["banners/new_pc.jpg", "banners/new_mobile.jpg"])
  })

  it("storage 삭제 실패해도 throw 안 함(비블로킹)", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "boom" } })
    await expect(
      removeNewBannerObjectsByPath(["banners/new_pc.jpg"])
    ).resolves.toBeUndefined()
    expect(captureMessage).toHaveBeenCalled()
  })

  it("remove가 throw해도 삼킴(비블로킹)", async () => {
    remove.mockRejectedValue(new Error("network"))
    await expect(
      removeNewBannerObjectsByPath(["banners/x.jpg"])
    ).resolves.toBeUndefined()
    expect(captureMessage).toHaveBeenCalledWith(
      "hero_banner_object_remove_threw",
      expect.anything()
    )
  })

  it("빈 배열은 remove 미호출", async () => {
    await removeNewBannerObjectsByPath([])
    expect(remove).not.toHaveBeenCalled()
  })
})
