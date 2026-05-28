// 상품 fit_type SSOT — v0.8 Track 1-A A-1.
// DB products.fit_type CHECK 제약(migration 040)과 동일 값 집합을 유지한다.
// Supabase 타입 generator는 CHECK constraint를 union literal로 만들지 않으므로 별도 SSOT 표준 (Day 22).
//
// ⚠️ Edge 미러: supabase/functions/_shared/seo/fit-type.ts 가 FIT_TYPE_LABELS를 미러링한다.
// 값/라벨 변경 시 양쪽 동기화 (worker가 prompt 입력에 한국어 라벨 사용).

export type FitType =
  | "REGULAR"
  | "SLIM"
  | "OVERSIZED"
  | "WIDE"
  | "STRAIGHT"
  | "LOOSE"
  | "CROPPED"

export const FIT_TYPE_VALUES: readonly FitType[] = [
  "REGULAR",
  "SLIM",
  "OVERSIZED",
  "WIDE",
  "STRAIGHT",
  "LOOSE",
  "CROPPED",
] as const

export const FIT_TYPE_LABELS: Record<FitType, string> = {
  REGULAR: "기본핏",
  SLIM: "슬림핏",
  OVERSIZED: "오버사이즈",
  WIDE: "와이드핏",
  STRAIGHT: "스트레이트",
  LOOSE: "루즈핏",
  CROPPED: "크롭",
}

export function parseFitType(value: unknown): FitType | null {
  if (typeof value !== "string") return null
  return FIT_TYPE_VALUES.includes(value as FitType) ? (value as FitType) : null
}
