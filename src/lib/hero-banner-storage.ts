// 히어로 배너 이미지의 storage path 도출 + banners/ prefix 가드.
// 순수 함수만 — next/cache·Sentry·supabase 의존 0 → API 라우트와 정리 스크립트(tsx) 양쪽에서 재사용.
// 배너는 product-images 버킷 'banners/' prefix에 저장(uploadHeroBannerImage).

export const BANNERS_PREFIX = "banners/"

// getPublicUrl 결과 형태: `${SUPABASE_URL}/storage/v1/object/public/product-images/banners/<key>`
const PUBLIC_MARKER = "/object/public/product-images/"

/**
 * 배너 public URL → storage object key(예: `banners/1718000000000_pc.jpg`).
 *
 * banners/ prefix 밖이거나 도출 불가하면 **null**(상품 이미지 등 오삭제 방지 가드).
 * getPublicUrl이 percent-encode 하므로 decode하여 업로드 시 사용한 raw key와 byte-level 일치시킴.
 */
export const deriveBannerStoragePath = (imageUrl: string | null | undefined): string | null => {
  if (!imageUrl) return null

  const idx = imageUrl.indexOf(PUBLIC_MARKER)
  if (idx === -1) return null

  // 마커 이후 ~ 쿼리/프래그먼트 전까지
  const raw = imageUrl.slice(idx + PUBLIC_MARKER.length).split("?")[0].split("#")[0]

  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null // malformed percent-encoding
  }

  // prefix 가드 — banners/ 밖이면 삭제 대상 아님
  if (!decoded.startsWith(BANNERS_PREFIX)) return null
  // path traversal 방어 + 빈 key 방어
  if (decoded.includes("..")) return null
  if (decoded.length <= BANNERS_PREFIX.length) return null

  return decoded
}
