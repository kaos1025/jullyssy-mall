// image/jpg: 일부 브라우저/OS 조합이 보내는 jpeg 변종. review-images 버킷(마이그 019)과 동일하게 허용.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

type ValidationResult = { ok: true } | { ok: false; message: string }

export const validateImageFile = (file: File): ValidationResult => {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, message: "이미지 파일(jpg/png/webp)만, 8MB 이하만 업로드 가능합니다" }
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, message: "이미지 파일(jpg/png/webp)만, 8MB 이하만 업로드 가능합니다" }
  }
  return { ok: true }
}
