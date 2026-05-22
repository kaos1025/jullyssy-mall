// 택배사 자유 입력 suggestion (어드민 datalist).
// 운영자가 자유 텍스트로 입력 가능 — 신규 택배사 등장 시 즉시 사용 가능(네이버 검색 추적 URL이
// 자유 텍스트로 동작). 향후 P2 COURIER-ENUM-SSOT-1에서 운영 데이터 누적 후 표준화 시 본 목록이 base.
export const COURIER_SUGGESTIONS = [
  "CJ대한통운",
  "롯데택배",
  "한진택배",
  "우체국택배",
] as const

export type CourierSuggestion = (typeof COURIER_SUGGESTIONS)[number]
