// SEO description 파서 — products.description HTML 내 <img> alt 일괄 삽입.
//
// Runtime: Deno (Edge Function) 전용. Vercel Node용 동일 모듈은
//   `src/lib/seo/description-parser.ts` (node-html-parser npm import).
// 라이브러리: node-html-parser@7.0.1.
//
// ⚠️ 시그니처 동기화 의무 ([[dual-runtime-signature]] feedback):
// `src/lib/seo/description-parser.ts`와 동일 인자/반환/동작을 유지한다.
// 한쪽 변경 시 다른 쪽 PR 동시 산출.
//
// Phase 0 실측: 네이버 SE 모든 <img>는 alt="" → 덮어쓰기 충돌 없음.
// description 당 <img> 40~99개 → spec FR-2 B "최대 3개" alt 생성 합리적.

// esm.sh CDN — Phase 1 B-2 학습: Supabase Edge production runtime은 subpath import 미지원.
// node-html-parser는 단일 export지만 일관성 위해 esm.sh 사용.
// @ts-ignore
import { parse } from "https://esm.sh/node-html-parser@7.0.1";

export interface AltInjection {
  /** 0-based img tag index (querySelectorAll 'img' 순서) */
  imageIndex: number;
  altText: string;
}

/**
 * D3 PoC — description-parser가 임포트 HTML에서 추출한 구조화 spec.
 * Vercel Node 측 `@/types/seo` SpecMetadata 와 동일 구조 (dual runtime 시그니처 동기화).
 */
export interface SpecMetadata {
  size?: string[];
  material?: string;
  washCare?: string;
  modelInfo?: string;
}

export interface InjectAltOptions {
  /** true 시 기존 alt가 있어도 덮어씀. 기본 false (보존) */
  overwriteExisting?: boolean;
}

export interface InjectAltResult {
  html: string;
  injected: number;
  preserved: number;
  totalImages: number;
}

export function injectAltTexts(
  html: string,
  injections: AltInjection[],
  options: InjectAltOptions = {},
): InjectAltResult {
  const overwrite = options.overwriteExisting ?? false;
  if (!html) {
    return { html: "", injected: 0, preserved: 0, totalImages: 0 };
  }

  const root = parse(html);
  const imgs = root.querySelectorAll("img");
  const altByIndex = new Map<number, string>(
    injections.map((i) => [i.imageIndex, i.altText]),
  );

  let injected = 0;
  let preserved = 0;

  imgs.forEach((img: { getAttribute: (n: string) => string | undefined; setAttribute: (n: string, v: string) => void }, idx: number) => {
    const existing = img.getAttribute("alt");
    const hasExisting = existing !== undefined && existing.trim() !== "";

    if (hasExisting && !overwrite) {
      preserved += 1;
      return;
    }
    const newAlt = altByIndex.get(idx);
    if (newAlt !== undefined) {
      img.setAttribute("alt", newAlt);
      injected += 1;
      return;
    }
    // injection 없으면 빈 alt 일괄 삽입 (spec v0.5 §FR-2 B: decorative).
    if (!hasExisting) {
      img.setAttribute("alt", "");
    }
  });

  return {
    html: root.toString(),
    injected,
    preserved,
    totalImages: imgs.length,
  };
}

/**
 * null-safe wrapper. description NULL 12건 처리용 (spec v0.4 §FR-5).
 * null/undefined/빈 문자열 → 그대로 반환 (no-op).
 */
export function ensureImgAlts(
  html: string | null | undefined,
  injections: AltInjection[],
  options: InjectAltOptions = {},
): string | null {
  if (html === null || html === undefined) return null;
  if (html === "") return "";
  return injectAltTexts(html, injections, options).html;
}

// =============================================================================
// D3 PoC — extractSpecMetadata (spec-48-1-d3-poc-v0.1 Track B-1)
//
// Vercel Node 측 src/lib/seo/description-parser.ts 와 동일 시그니처/동작
// (Day 28 dual-runtime-signature feedback). import만 esm.sh 차이.
// =============================================================================

const SPEC_SIZE_LABEL_RE = /(사이즈|치수|SIZE|Size|size)/;
const SPEC_MATERIAL_LABEL_RE = /(소재|혼용률|혼방|원단|MATERIAL|Material)/;
const SPEC_WASH_LABEL_RE = /(세탁|관리법|드라이|손세탁|취급|세탁방법|WASH|CARE)/;
const SPEC_MODEL_LABEL_RE = /(모델|착장|착용정보|MODEL|Model)/;

const SIZE_TOKEN_RE = /\b(XS|S|M|L|XL|XXL|FREE|F|44|55|66|77|88|90|95|100)\b/g;
const MATERIAL_PERCENT_RE = /([가-힣A-Za-z]+\s*\d{1,3}\s*%(?:\s*[,，·]\s*[가-힣A-Za-z]+\s*\d{1,3}\s*%)*)/;

function extractSizeTokens(text: string): string[] {
  const tokens = text.match(SIZE_TOKEN_RE);
  if (!tokens) return [];
  return Array.from(new Set(tokens));
}

function pickFromLabelValue(
  label: string,
  value: string,
  spec: SpecMetadata,
): void {
  if (!value) return;
  if (SPEC_SIZE_LABEL_RE.test(label) && !spec.size) {
    const tokens = extractSizeTokens(value);
    spec.size = tokens.length > 0 ? tokens : [value.slice(0, 100)];
  } else if (SPEC_MATERIAL_LABEL_RE.test(label) && !spec.material) {
    spec.material = value.slice(0, 200);
  } else if (SPEC_WASH_LABEL_RE.test(label) && !spec.washCare) {
    spec.washCare = value.slice(0, 200);
  } else if (SPEC_MODEL_LABEL_RE.test(label) && !spec.modelInfo) {
    spec.modelInfo = value.slice(0, 200);
  }
}

function isEmptySpec(spec: SpecMetadata): boolean {
  return !spec.size && !spec.material && !spec.washCare && !spec.modelInfo;
}

interface ParserNode {
  text?: string;
  querySelectorAll: (sel: string) => ParserNode[];
}

/**
 * 임포트 HTML에서 spec 정보를 휴리스틱 추출. AI 호출 없음.
 * 추출 우선순위: table tr → li (colon 패턴) → 정규식 fallback (소재 %).
 * 추출 실패는 빈 객체 반환. throw 금지.
 */
export function extractSpecMetadata(html: string | null | undefined): SpecMetadata {
  if (html === null || html === undefined || html === "") return {};
  let root: ParserNode;
  try {
    root = parse(html) as ParserNode;
  } catch {
    return {};
  }
  const spec: SpecMetadata = {};

  // 1. table tr 순회
  const rows = root.querySelectorAll("tr");
  for (const row of rows) {
    const cells = row.querySelectorAll("th, td");
    if (cells.length < 2) continue;
    const label = (cells[0].text ?? "").trim();
    const value = cells
      .slice(1)
      .map((c: ParserNode) => (c.text ?? "").trim())
      .filter((s: string) => s !== "")
      .join(" ")
      .trim();
    pickFromLabelValue(label, value, spec);
  }

  // 2. li 순회
  const items = root.querySelectorAll("li");
  for (const item of items) {
    const text = (item.text ?? "").trim();
    const colonMatch = text.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
    if (colonMatch) {
      pickFromLabelValue(colonMatch[1].trim(), colonMatch[2].trim(), spec);
    }
  }

  // 3. 정규식 fallback (소재 % 패턴)
  if (!spec.material) {
    const plainText = (root.text ?? "").replace(/\s+/g, " ");
    const materialMatch = plainText.match(MATERIAL_PERCENT_RE);
    if (materialMatch) spec.material = materialMatch[1].trim().slice(0, 200);
  }

  if (isEmptySpec(spec)) return {};
  return spec;
}
