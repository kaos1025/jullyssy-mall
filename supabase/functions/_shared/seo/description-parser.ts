// SEO description 파서 — products.description HTML 내 <img> alt 일괄 삽입.
//
// Runtime: Deno (Edge Function) + Node (Next.js 승인 API). npm: specifier 사용.
// 라이브러리: node-html-parser@7.0.1.
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
    if (newAlt) {
      img.setAttribute("alt", newAlt);
      injected += 1;
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
