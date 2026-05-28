// fit_type 한국어 라벨 — Edge 미러 (Deno).
//
// ⚠️ SSOT: src/lib/product/fit-type.ts (Vercel Node). 값/라벨 변경 시 양쪽 동기화 의무.
// Edge는 @/ alias import 불가 → worker가 product.fit_type을 한국어 라벨로 변환해
// replace prompt 입력 컨텍스트에 사용 (v0.8 Track 1-A A-4).

export type FitType =
  | "REGULAR"
  | "SLIM"
  | "OVERSIZED"
  | "WIDE"
  | "STRAIGHT"
  | "LOOSE"
  | "CROPPED";

export const FIT_TYPE_LABELS: Record<FitType, string> = {
  REGULAR: "기본핏",
  SLIM: "슬림핏",
  OVERSIZED: "오버사이즈",
  WIDE: "와이드핏",
  STRAIGHT: "스트레이트",
  LOOSE: "루즈핏",
  CROPPED: "크롭",
};
