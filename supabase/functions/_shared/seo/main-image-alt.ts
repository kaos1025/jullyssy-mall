// 메인 갤러리 4번째 이미지 이후 패턴 alt 생성 (spec FR-2 B).
// AI는 상위 3장에 한해 alt 생성, 4번째 이후는 패턴 적용.

export function buildPatternAlt(
  productName: string,
  indexFromFour: number,
): string {
  return `${productName} 상세컷 ${indexFromFour}`;
}
