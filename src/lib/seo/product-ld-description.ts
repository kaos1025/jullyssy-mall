// PDP Product JSON-LD / OpenGraph description 소스 SSOT — PDP-LD-DESC-1.
//
// 우선순위: (a) products.meta_description(AI SEO, 상품중심·≤155) → (c) body 안내문 strip
//          → fallback 상품명. 안내문("주문 전 필독"/"혜택 안내") 보일러플레이트를 description에서
// 배제해 검색 리치 결과/스니펫 품질을 보장한다 (name/offers/policy 등 다른 LD 필드는 무관).
//
// (c) strip 한계: body 안내문은 운영자/네이버 DB content(코드 상수 아님)라 마커 휴리스틱이다.
// "N만원 이상 배송비 무료"(안내문 종료) 첫 매치 이후를 상품 본문으로 채택 — ACTIVE 안내문 95%
// 커버(Phase 0 확증). 마커 미발견 시 보수적으로 정리만(과도 strip 회피). null-meta 구간은 운영자
// meta_description backfill 권고로 (a) 커버리지를 높여 (c) 의존을 줄인다.

export interface LdDescriptionSource {
  name: string
  description?: string | null
  meta_description?: string | null
}

const DEFAULT_MAX_LEN = 200

// 안내문 종료 마커: "N만원 이상 배송비 무료" 이후가 상품 본문 (Phase 0 확증).
const NOTICE_END_RE = /\d+\s*만원\s*이상\s*배송비\s*무료/
// 안내문 존재 신호 (clean body 오작동 방지 가드 — 신호 없으면 strip 미적용).
const NOTICE_SIGNAL_RE = /주문\s*전\s*필독|혜택\s*안내|알림\s*받기/
// 안내문은 항상 prefix — 종료 마커 실측 위치 287~350자. 이 영역 밖(>600) 매치는 상품 본문의
// 우연한 "N만원 배송비 무료" 언급으로 보고 strip 안 함 (본문 손실 false-positive 차단).
const NOTICE_REGION_MAX = 600

const stripHtmlAndCollapse = (raw: string): string =>
  raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[|​]/g, " ") // pipe + zero-width space(​)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()

// 본문 양끝의 따옴표/구분기호 noise 제거 (네이버 HTML 잔여).
const trimEdgeNoise = (s: string): string =>
  s
    .replace(/^[\s"'’“”`|·∙•]+/, "")
    .replace(/[\s"'’“”`|·]+$/, "")
    .trim()

/**
 * 안내문 보일러플레이트 strip. 안내문 신호가 있을 때만 종료 마커 이후 상품 본문을 채택하고,
 * 신호/마커가 없으면 HTML·공백만 정리해 원문을 보존(보수적). 반환 빈 문자열 가능.
 */
export const stripOrderBoilerplate = (raw: string): string => {
  const text = stripHtmlAndCollapse(raw)
  if (!text) return ""
  if (NOTICE_SIGNAL_RE.test(text)) {
    const m = text.match(NOTICE_END_RE)
    if (m && m.index !== undefined && m.index <= NOTICE_REGION_MAX) {
      const body = trimEdgeNoise(text.slice(m.index + m[0].length))
      if (body.length >= 10) return body // 의미있는 본문 확보 시에만 채택
    }
  }
  return trimEdgeNoise(text)
}

/**
 * PDP Product JSON-LD / OG description 소스. (a) meta_description → (c) body strip → 상품명.
 * null/빈 description을 회피하기 위해 최종 fallback은 항상 상품명.
 */
export const getProductLdDescription = (
  product: LdDescriptionSource,
  maxLen: number = DEFAULT_MAX_LEN,
): string => {
  // (a) AI SEO meta — 상품중심·clean. HTML 잔여 방어 차원에서 경량 정리(보통 no-op).
  const meta = product.meta_description?.trim()
  if (meta) {
    const cleaned = stripHtmlAndCollapse(meta)
    if (cleaned) return cleaned.slice(0, maxLen)
  }

  // (c) body 안내문 strip
  if (product.description) {
    const stripped = stripOrderBoilerplate(product.description)
    if (stripped) return stripped.slice(0, maxLen)
  }

  return product.name // fallback — null description 회피
}
