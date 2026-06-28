// 네이버 커머스 product-attributes dictionary — v0.8 Track 1-A A-2.
//
// 네이버 상품의 detailAttribute.productAttributes는 { attributeSeq, attributeValueSeq }
// 쌍만 담는다(ID만, 라벨 없음). 카테고리별 dictionary 2종을 조회해 ID→라벨로 해소한다.
//   - endpoint B (attributes): attributeSeq → attributeName ("핏" 등) + 분류 타입
//   - endpoint A (attribute-values): (attributeSeq, attributeValueSeq) → minAttributeValue (라벨)
//
// Phase 0' 실측(블라우스 50000804): 핏 attributeName="핏"(SINGLE_SELECT), 라벨 5종
//   슬림핏/기본핏/루즈핏·오버핏/머슬핏/기타. minAttributeValue가 사람이 읽는 라벨임 확증.
//
// Runtime: Vercel Node 전용 (네이버 import route). Edge worker에서 호출하지 않음.

import { NAVER_API_BASE, naverFetch } from "@/lib/naver"
import type { FitType } from "@/lib/product/fit-type"

// endpoint B 응답 항목 (실측 shape)
interface NaverAttributeMeta {
  attributeSeq: number
  attributeName: string
  attributeClassificationType?: string
}

// endpoint A 응답 항목 (실측 shape)
interface NaverAttributeValueMeta {
  attributeSeq: number
  attributeValueSeq: number
  minAttributeValue: string
}

export interface NaverAttributeInfo {
  attributeSeq: number
  attributeName: string
  classificationType: string | null
  /** attributeValueSeq → 라벨(minAttributeValue) */
  values: Map<number, string>
}

/** attributeSeq → attribute 정보 */
export type NaverCategoryDict = Map<number, NaverAttributeInfo>

// 같은 import 세션(동일 함수 인스턴스) 내 카테고리별 dedup.
// 카테고리 속성은 사실상 정적이라 인스턴스 캐시로 충분. DB persistence는 P2(IMPORT-DICTIONARY-CACHE-DB-1).
const dictCache = new Map<string, NaverCategoryDict>()

const fetchAttributeArray = async <T>(
  path: string,
  naverCategoryId: string,
  token: string,
): Promise<T[]> => {
  // naverFetch 경유 — 프록시(NAVER_PROXY_URL) 있으면 그쪽으로(고정IP). Authorization은 token 인자로 주입.
  const res = await naverFetch(
    `${NAVER_API_BASE}${path}?categoryId=${encodeURIComponent(naverCategoryId)}`,
    { headers: { Accept: "application/json;charset=UTF-8" } },
    token,
  )
  if (!res.ok) {
    throw new Error(`네이버 속성 조회 실패 (${path}): ${res.status}`)
  }
  const json: unknown = await res.json()
  // 응답은 배열 또는 { contents: [...] } 형태 — 실측은 최상위 배열.
  if (Array.isArray(json)) return json as T[]
  if (json && typeof json === "object") {
    const contents = (json as Record<string, unknown>).contents
    if (Array.isArray(contents)) return contents as T[]
  }
  return []
}

/**
 * 카테고리별 attribute dictionary 조회 (endpoint B + A 동시 호출 후 merge).
 * 같은 카테고리 재조회 시 메모리 cache 반환. 실패 시 throw (호출측 Layer fallback).
 */
export const getNaverAttributeDict = async (
  naverCategoryId: string,
  token: string,
): Promise<NaverCategoryDict> => {
  const cached = dictCache.get(naverCategoryId)
  if (cached) return cached

  const [attrs, values] = await Promise.all([
    fetchAttributeArray<NaverAttributeMeta>(
      "/v1/product-attributes/attributes",
      naverCategoryId,
      token,
    ),
    fetchAttributeArray<NaverAttributeValueMeta>(
      "/v1/product-attributes/attribute-values",
      naverCategoryId,
      token,
    ),
  ])

  const dict: NaverCategoryDict = new Map()
  for (const a of attrs) {
    dict.set(a.attributeSeq, {
      attributeSeq: a.attributeSeq,
      attributeName: a.attributeName,
      classificationType: a.attributeClassificationType ?? null,
      values: new Map(),
    })
  }
  for (const v of values) {
    dict.get(v.attributeSeq)?.values.set(v.attributeValueSeq, v.minAttributeValue)
  }

  dictCache.set(naverCategoryId, dict)
  return dict
}

// 네이버 핏 라벨 → SSOT FitType. 카테고리별 라벨 세트가 다르고 복합 라벨
// ("루즈핏/오버핏")이 존재해 substring 키워드 매칭을 사용한다.
//
// ⚠️ 우선순위: '루즈' > '오버' — 복합 라벨 "루즈핏/오버핏"을 LOOSE로 매핑 (PM 결정).
//    그 외 마케팅 term('머슬핏' 등 SSOT 미대응)은 null 반환 → 호출측 fallback(→ REGULAR).
const NAVER_FIT_LABEL_KEYWORDS: ReadonlyArray<readonly [RegExp, FitType]> = [
  [/크롭|cropped?/i, "CROPPED"],
  [/스트레이트|straight/i, "STRAIGHT"],
  [/와이드|wide/i, "WIDE"],
  [/루즈/i, "LOOSE"],
  [/오버\s*핏|오버\s*사이즈|박시|oversized?/i, "OVERSIZED"],
  [/슬림|스키니|slim/i, "SLIM"],
  [/기본|레귤러|regular/i, "REGULAR"],
]

/** 네이버 핏 라벨 → FitType. 미대응 라벨은 null. */
export const mapNaverFitLabel = (label: string): FitType | null => {
  for (const [pattern, fitType] of NAVER_FIT_LABEL_KEYWORDS) {
    if (pattern.test(label)) return fitType
  }
  return null
}

/**
 * productAttributes에서 fit_type 추출.
 * dict에서 attributeName === "핏" 항목을 찾아(하드코딩 X — 카테고리별 attributeSeq 상이),
 * 해당 attributeSeq의 attributeValueSeq → 라벨 → FitType 역매핑. 무매치 시 null.
 */
export const lookupFitFromProductAttributes = (
  productAttributes: Array<{ attributeSeq: number; attributeValueSeq: number }>,
  dict: NaverCategoryDict,
): FitType | null => {
  const fitAttr = Array.from(dict.values()).find(
    (info) => info.attributeName === "핏"
  )
  if (!fitAttr) return null

  const match = productAttributes.find((pa) => pa.attributeSeq === fitAttr!.attributeSeq)
  if (!match) return null

  const label = fitAttr.values.get(match.attributeValueSeq)
  if (!label) return null

  return mapNaverFitLabel(label)
}
