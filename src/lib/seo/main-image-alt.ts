// 메인 갤러리 4번째 이미지 이후 패턴 alt 생성 (spec FR-2 B).
// AI는 상위 3장에 한해 alt 생성, 4번째 이후는 패턴 적용.
//
// ⚠️ 시그니처 동기화 의무:
// 본 모듈과 `supabase/functions/_shared/seo/main-image-alt.ts` (Edge worker용)는
// 동일 시그니처 유지. 한쪽 변경 시 다른 쪽 PR 동시 산출. Day 28 학습 (의미 단일화).

export function buildPatternAlt(
  productName: string,
  indexFromFour: number,
): string {
  return `${productName} 상세컷 ${indexFromFour}`
}
