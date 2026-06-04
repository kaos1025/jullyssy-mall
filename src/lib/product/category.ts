// 상품 카테고리 분류 SSOT — v0.8 Track G.
// 의류군(fit_type 의미 있음) vs 비의류(가방/신발/악세서리, fit_type NULL) 판정 기준을
// refit-batch(D5) / 네이버 import auto-hook / JSON-LD가 공유한다 (분류 divergence 차단).
//
// categories 시드 slug 규약: TOP = top/bottom/outer/dress(의류), bag/shoes/accessory(비의류).
// 하위 카테고리는 부모 TOP의 slug로 판정한다 (자신 slug top-/bottom-/... 또는 TOP 직속 top).

export const APPAREL_TOP_SLUGS = [
  "top",
  "bottom",
  "outer",
  "dress",
] as const

/** category의 TOP slug(자신 또는 부모)가 의류군인지. */
export function isApparelTopSlug(slug: string | null | undefined): boolean {
  return !!slug && (APPAREL_TOP_SLUGS as readonly string[]).includes(slug)
}
