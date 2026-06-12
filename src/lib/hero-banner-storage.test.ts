import { describe, it, expect } from "vitest"
import { BANNERS_PREFIX, deriveBannerStoragePath } from "./hero-banner-storage"

const BASE = "https://abc.supabase.co/storage/v1/object/public/product-images/"
// getPublicUrl이 percent-encode 하는 방식 모사 (segment별 인코딩, '/'는 보존)
const publicUrl = (key: string) =>
  BASE + key.split("/").map(encodeURIComponent).join("/")

describe("deriveBannerStoragePath — 정상 경로", () => {
  it("banners/ public URL → object key 도출", () => {
    expect(deriveBannerStoragePath(publicUrl("banners/1718000000000_pc.jpg"))).toBe(
      "banners/1718000000000_pc.jpg"
    )
  })

  it("쿼리스트링은 제거", () => {
    expect(
      deriveBannerStoragePath(publicUrl("banners/1718_mobile.webp") + "?token=abc&x=1")
    ).toBe("banners/1718_mobile.webp")
  })

  it("디코드 왕복: 인코딩된 URL → 업로드 시 사용한 raw key와 byte-level 일치", () => {
    const key = `${BANNERS_PREFIX}1718_pc 사본.jpg` // 공백 + 한글 (percent-encode 대상)
    const url = publicUrl(key)
    expect(url).toContain("%20") // 실제로 인코딩됐는지 확인
    expect(url).not.toContain(" ")
    expect(deriveBannerStoragePath(url)).toBe(key) // 역산 = storage object key
  })
})

describe("deriveBannerStoragePath — prefix 가드 (오삭제 방지)", () => {
  it("products/ prefix는 null (상품 이미지 보호)", () => {
    expect(deriveBannerStoragePath(publicUrl("products/abc_1.jpg"))).toBeNull()
  })

  it("marker 없는 URL은 null", () => {
    expect(deriveBannerStoragePath("https://cdn.example.com/banners/x.jpg")).toBeNull()
  })

  it("다른 버킷(review-images) URL은 null", () => {
    expect(
      deriveBannerStoragePath(
        "https://abc.supabase.co/storage/v1/object/public/review-images/banners/x.jpg"
      )
    ).toBeNull()
  })

  it("path traversal은 null", () => {
    expect(
      deriveBannerStoragePath(publicUrl("banners/../products/secret.jpg"))
    ).toBeNull()
  })

  it("banners/ 만 있고 key 없으면 null", () => {
    expect(deriveBannerStoragePath(publicUrl("banners/"))).toBeNull()
  })

  it("null/빈 문자열 입력은 null", () => {
    expect(deriveBannerStoragePath(null)).toBeNull()
    expect(deriveBannerStoragePath(undefined)).toBeNull()
    expect(deriveBannerStoragePath("")).toBeNull()
  })
})
