import { describe, it, expect } from "vitest"
import { validateImageFile } from "./image-upload-validation"

const MAX_SIZE = 8 * 1024 * 1024 // 8MB — 코드 상한과 동일

// validateImageFile은 File의 type/size만 참조하므로 최소 stub으로 계약을 표현.
// (node 버전 무관 포터블 — global File 미의존, 8MB 실할당 회피)
const fakeFile = (type: string, size: number): File =>
  ({ type, size }) as unknown as File

describe("validateImageFile — MIME whitelist", () => {
  it("image/jpeg 허용", () => {
    expect(validateImageFile(fakeFile("image/jpeg", 1024)).ok).toBe(true)
  })

  it("image/jpg 변종 허용 (A-2 핵심 — 일부 브라우저/OS가 보내는 jpeg 변종)", () => {
    expect(validateImageFile(fakeFile("image/jpg", 1024)).ok).toBe(true)
  })

  it("image/png 허용", () => {
    expect(validateImageFile(fakeFile("image/png", 1024)).ok).toBe(true)
  })

  it("image/webp 허용", () => {
    expect(validateImageFile(fakeFile("image/webp", 1024)).ok).toBe(true)
  })

  it("image/gif 거부 (비허용 MIME 유지)", () => {
    const r = validateImageFile(fakeFile("image/gif", 1024))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain("업로드")
  })

  it("image/svg+xml 거부", () => {
    expect(validateImageFile(fakeFile("image/svg+xml", 1024)).ok).toBe(false)
  })

  it("application/pdf 거부", () => {
    expect(validateImageFile(fakeFile("application/pdf", 1024)).ok).toBe(false)
  })

  it("빈 MIME 거부", () => {
    expect(validateImageFile(fakeFile("", 1024)).ok).toBe(false)
  })
})

describe("validateImageFile — 크기 상한 (8MB)", () => {
  it("정확히 8MB는 통과 (경계 — 이하 허용)", () => {
    expect(validateImageFile(fakeFile("image/jpeg", MAX_SIZE)).ok).toBe(true)
  })

  it("8MB + 1byte는 거부", () => {
    const r = validateImageFile(fakeFile("image/jpeg", MAX_SIZE + 1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain("업로드")
  })

  it("허용 MIME여도 크기 초과면 거부", () => {
    expect(validateImageFile(fakeFile("image/webp", MAX_SIZE + 1024)).ok).toBe(false)
  })

  it("0 byte는 크기 측면에서 통과 (빈 파일 차단은 라우트 책임)", () => {
    expect(validateImageFile(fakeFile("image/png", 0)).ok).toBe(true)
  })
})
