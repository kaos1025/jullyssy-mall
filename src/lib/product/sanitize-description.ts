// 상세설명 HTML sanitize — 렌더 출력 경계 방어(XSS 하드닝).
//
// products.description은 네이버 SmartEditor ONE(se-*) HTML이라 dangerouslySetInnerHTML로
// 렌더된다. 외부(준신뢰) HTML이므로 script/이벤트핸들러/위험 URL을 제거한다.
//
// 원칙: 방금 머지한 se-* 스코프 CSS 렌더를 깨지 않도록 "위험한 것만 제거, 표현은 최대 보존".
//   - 보존: se-* 클래스(class), 인라인 스타일(색/배경/정렬/줄높이), 이미지, font color, 표/리스트 구조
//   - 제거: <script>/<iframe>/<object>/<embed>/<form> 등 + on* 핸들러 + javascript: URL
//
// DB는 불변 — 저장 원본(description/description_raw)은 그대로 두고 읽기 시에만 정화한다.

import sanitizeHtml from "sanitize-html"

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "div", "span", "p", "br", "hr", "a", "img", "font",
    "strong", "b", "em", "i", "u", "s", "del", "mark", "small", "sub", "sup",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "figure", "figcaption", "section", "article",
  ],
  allowedAttributes: {
    "*": ["class", "style", "id", "align"],
    a: ["href", "target", "rel", "name"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    font: ["color", "face", "size"],
    td: ["colspan", "rowspan", "width", "height"],
    th: ["colspan", "rowspan", "width", "height"],
    col: ["span", "width"],
  },
  // se-* 클래스/인라인 스타일은 값 제한 없이 보존(allowedClasses/allowedStyles 미설정).
  allowedSchemes: ["http", "https", "data", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  // 비허용 태그는 제거하되 텍스트 자식은 보존(unwrap) — <font> 등 텍스트 손실 방지.
  disallowedTagsMode: "discard",
}

/**
 * 상세설명 HTML을 렌더 직전 정화. null/빈 문자열은 그대로 통과(no-op).
 * 정보 손실 최소화 — 위험 태그/속성만 제거하고 se-* 표현은 보존한다.
 */
export function sanitizeDescriptionHtml(
  html: string | null | undefined,
): string | null {
  if (html === null || html === undefined) return null
  if (html === "") return ""
  return sanitizeHtml(html, OPTIONS)
}
