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
import type { AltInjection } from "@/types/seo"

export type { AltInjection }

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
