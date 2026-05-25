// 이메일 inline hex SSOT
// 출처: docs/design-system/project/colors_and_type.css (쥴리씨 hex SSOT)
// 이메일 클라이언트는 CSS 변수 미지원 → 모든 색상은 inline hex로 주입
//
// 토큰 명세는 Phase 2-A § 디자인 토큰 옵션 B 확정 (2026-05-24)
export const emailTokens = {
  // Brand
  primary: "#F97316", // colors_and_type.css:27 --primary-500
  primaryFg: "#FFFFFF", // colors_and_type.css:31 --primary-fg

  // Surfaces
  background: "#FFFFFF", // colors_and_type.css:9  --white
  cardBg: "#FAFAFA", // colors_and_type.css:11 --gray-50 — 결제 요약 박스

  // Text
  foreground: "#171717", // colors_and_type.css:17 --gray-900 — 본문/제목
  muted: "#6B7280", // colors_and_type.css:15 --gray-500 — 라벨/메타
  priceStrike: "#9CA3AF", // colors_and_type.css:14 --gray-400 — 할인 전 가격

  // Lines
  border: "#E8E8E8", // colors_and_type.css:12 --gray-200 — 표/구분선
} as const

// 폰트 fallback — 메일 클라이언트는 웹폰트 일부만 지원
// Pretendard는 한국어 메일에서 fallback 후행 폰트만 적용될 가능성 높음 → "Apple SD Gothic Neo / Malgun Gothic / sans-serif" 보장
export const emailFonts = {
  sans:
    '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, ' +
    '"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
  display:
    '"Cormorant Garamond", "Times New Roman", Georgia, serif',
} as const
