// SEO description 파서 — products.description HTML 내 <img> alt 일괄 삽입.
//
// Runtime: Vercel Node (Next.js admin 승인 API 전용).
// 라이브러리: node-html-parser@7.0.1 (npm).
//
// ⚠️ 시그니처 동기화 의무:
// 본 모듈과 `supabase/functions/_shared/seo/description-parser.ts` (Edge worker용,
// esm.sh import)는 동일 시그니처를 유지해야 한다. 한쪽 변경 시 다른 쪽 PR을 동시 산출.
// import 메커니즘만 다르며 의미·인자·반환은 단일화. Day 28 학습 (의미 단일화).

import { parse } from "node-html-parser"
import type { AltInjection, SpecMetadata } from "@/types/seo"
import type { FitType } from "@/lib/product/fit-type"

export type { AltInjection, SpecMetadata }

export interface InjectAltOptions {
  /** true 시 기존 alt가 있어도 덮어씀. 기본 false (보존). */
  overwriteExisting?: boolean
}

export interface InjectAltResult {
  html: string
  injected: number
  preserved: number
  totalImages: number
}

export function injectAltTexts(
  html: string,
  injections: AltInjection[],
  options: InjectAltOptions = {},
): InjectAltResult {
  const overwrite = options.overwriteExisting ?? false
  if (!html) {
    return { html: "", injected: 0, preserved: 0, totalImages: 0 }
  }

  const root = parse(html)
  const imgs = root.querySelectorAll("img")
  const altByIndex = new Map<number, string>(
    injections.map((i) => [i.imageIndex, i.altText]),
  )

  let injected = 0
  let preserved = 0

  imgs.forEach((img, idx) => {
    const existing = img.getAttribute("alt")
    const hasExisting = existing !== undefined && existing.trim() !== ""

    if (hasExisting && !overwrite) {
      preserved += 1
      return
    }
    const newAlt = altByIndex.get(idx)
    if (newAlt !== undefined) {
      img.setAttribute("alt", newAlt)
      injected += 1
      return
    }
    // injection 없으면 빈 alt 일괄 삽입 (Phase 2 명세: description 임베디드 이미지는 decorative).
    if (!hasExisting) {
      img.setAttribute("alt", "")
    }
  })

  return {
    html: root.toString(),
    injected,
    preserved,
    totalImages: imgs.length,
  }
}

/**
 * null-safe wrapper.
 * - null/undefined: 그대로 반환 (no-op, description NULL 케이스)
 * - 빈 문자열: 그대로 반환
 * - 그 외: injectAltTexts 결과 html 반환
 *
 * injections=[] 빈 배열 호출 시에도 정상 동작 — 기존 alt 보존 + 비어있던 alt에 ""
 * 일괄 삽입 (decorative). Phase 2 승인 라우트는 이 패턴으로 호출.
 */
export function ensureImgAlts(
  html: string | null | undefined,
  injections: AltInjection[] = [],
  options: InjectAltOptions = {},
): string | null {
  if (html === null || html === undefined) return null
  if (html === "") return ""
  return injectAltTexts(html, injections, options).html
}

// =============================================================================
// D3 PoC — extractSpecMetadata (spec-48-1-d3-poc-v0.1 Track B-1)
//
// 스마트스토어 임포트 HTML에서 spec 정보 (사이즈/소재/세탁법/모델착장)를 휴리스틱
// 추출. AI 호출 없이 동기 처리. 정보 손실 0 — 추출 실패는 빈 객체 반환 (throw 금지).
//
// dual runtime: 본 모듈 + supabase/functions/_shared/seo/description-parser.ts
// 시그니처/동작 동일 (Day 28 dual-runtime-signature feedback).
// =============================================================================

const SPEC_SIZE_LABEL_RE = /(사이즈|치수|SIZE|Size|size)/
const SPEC_MATERIAL_LABEL_RE = /(소재|혼용률|혼방|원단|MATERIAL|Material)/
const SPEC_WASH_LABEL_RE = /(세탁|관리법|드라이|손세탁|취급|세탁방법|WASH|CARE)/
const SPEC_MODEL_LABEL_RE = /(모델|착장|착용정보|MODEL|Model)/

const SIZE_TOKEN_RE = /\b(XS|S|M|L|XL|XXL|FREE|F|44|55|66|77|88|90|95|100)\b/g
const MATERIAL_PERCENT_RE = /([가-힣A-Za-z]+\s*\d{1,3}\s*%(?:\s*[,，·]\s*[가-힣A-Za-z]+\s*\d{1,3}\s*%)*)/

function extractSizeTokens(text: string): string[] {
  const tokens = text.match(SIZE_TOKEN_RE)
  if (!tokens) return []
  return Array.from(new Set(tokens))
}

function pickFromLabelValue(
  label: string,
  value: string,
  spec: SpecMetadata,
): void {
  if (!value) return
  if (SPEC_SIZE_LABEL_RE.test(label) && !spec.size) {
    const tokens = extractSizeTokens(value)
    spec.size = tokens.length > 0 ? tokens : [value.slice(0, 100)]
  } else if (SPEC_MATERIAL_LABEL_RE.test(label) && !spec.material) {
    spec.material = value.slice(0, 200)
  } else if (SPEC_WASH_LABEL_RE.test(label) && !spec.washCare) {
    spec.washCare = value.slice(0, 200)
  } else if (SPEC_MODEL_LABEL_RE.test(label) && !spec.modelInfo) {
    spec.modelInfo = value.slice(0, 200)
  }
}

function isEmptySpec(spec: SpecMetadata): boolean {
  return !spec.size && !spec.material && !spec.washCare && !spec.modelInfo
}

/**
 * 임포트 HTML에서 spec 정보를 휴리스틱 추출.
 * 추출 우선순위: table tr (label/value 2-cell) → li (colon 패턴) → 정규식 fallback (소재 %).
 * 추출 실패는 빈 객체 반환. throw 금지.
 */
export function extractSpecMetadata(html: string | null | undefined): SpecMetadata {
  if (html === null || html === undefined || html === "") return {}
  let root
  try {
    root = parse(html)
  } catch {
    return {}
  }
  const spec: SpecMetadata = {}

  // 1. table tr 순회 (가장 흔한 패턴)
  const rows = root.querySelectorAll("tr")
  for (const row of rows) {
    const cells = row.querySelectorAll("th, td")
    if (cells.length < 2) continue
    const label = (cells[0].text ?? "").trim()
    const value = cells
      .slice(1)
      .map((c) => (c.text ?? "").trim())
      .filter((s) => s !== "")
      .join(" ")
      .trim()
    pickFromLabelValue(label, value, spec)
  }

  // 2. li 순회 (table 미사용 시 또는 보완)
  const items = root.querySelectorAll("li")
  for (const item of items) {
    const text = (item.text ?? "").trim()
    const colonMatch = text.match(/^([^:：]{1,30})[:：]\s*(.+)$/)
    if (colonMatch) {
      pickFromLabelValue(colonMatch[1].trim(), colonMatch[2].trim(), spec)
    }
  }

  // 3. 정규식 fallback (소재 % 패턴, table/li 모두 매칭 실패 시)
  if (!spec.material) {
    const plainText = (root.text ?? "").replace(/\s+/g, " ")
    const materialMatch = plainText.match(MATERIAL_PERCENT_RE)
    if (materialMatch) spec.material = materialMatch[1].trim().slice(0, 200)
  }

  // 빈 객체면 그대로 반환 (정보 손실 0 원칙)
  if (isEmptySpec(spec)) return {}
  return spec
}

// =============================================================================
// v0.8 Track 1-A A-3 — extractFitFromDescription
//
// description HTML 본문에서 fit 키워드를 휴리스틱 매칭. 무매치 시 null.
// Layer 3 default 'REGULAR' fallback은 호출 측(네이버 import route, A-2 세션 2) 책임.
//
// ⚠️ Edge worker sync 의무 외 — 본 함수는 Vercel Node 측만 사용(네이버 import route).
// Edge worker는 fit_type을 prompt 입력 컨텍스트로만 활용(A-4). 운영 데이터 누적 후 키워드 보정 가능.
// =============================================================================

// 우선순위 영역(상위 → 하위, 첫 매치 반환). 충돌 시 더 강한 신호 우선
// (예: "오버사이즈 슬림" → OVERSIZED, "와이드 슬림" → WIDE).
const FIT_KEYWORD_MAP: Array<[RegExp, FitType]> = [
  [/오버(핏|\s*사이즈)|박시|oversized?/i, "OVERSIZED"],
  [/크롭(드|핏)?|cropped?/i, "CROPPED"],
  [/스트레이트|straight/i, "STRAIGHT"],
  [/와이드(핏)?|wide(\s*fit)?/i, "WIDE"],
  [/루즈(핏)?|loose(\s*fit)?/i, "LOOSE"],
  [/슬림(핏)?|스키니|slim(\s*fit)?/i, "SLIM"],
  [/기본핏|레귤러|regular(\s*fit)?/i, "REGULAR"],
]

/**
 * description HTML/텍스트에서 fit 키워드 매칭. 매칭 실패 시 null 반환.
 * Layer 3 default 'REGULAR'는 호출 측 책임.
 */
export function extractFitFromDescription(
  html: string | null | undefined,
): FitType | null {
  if (!html) return null

  // HTML 태그 제거 + 공백 정리 (간이 텍스트 추출)
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase()

  for (const [pattern, fitType] of FIT_KEYWORD_MAP) {
    if (pattern.test(text)) return fitType
  }

  return null
}
