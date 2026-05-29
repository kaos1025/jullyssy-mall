// v0.8 Track 1-A A-2 — fit_type 매핑 로직 단위 검증 (Phase 0' 실측 데이터 기반).
//
// 실행: npx tsx scripts/seo-poc/fit-mapping-verify.ts
//
// 커버:
// 1. mapNaverFitLabel — 블라우스 핏 실측 라벨 5종 (슬림핏/기본핏/루즈핏·오버핏/머슬핏/기타)
//    + 복합 라벨 "루즈핏/오버핏" → LOOSE (PM 결정), 미대응 라벨 → null
// 2. lookupFitFromProductAttributes — 실측 productAttributes(블라우스/가방) ID→라벨→FitType
// 3. FIT_KEYWORD_MAP 정정 — 단독 키워드(슬림/와이드/크롭) false positive 제거
// 4. extractFitFromTags — sellerTags 키워드 매칭
//
// vitest 미도입 — sibling description-parser-node-test.ts 와 동일 패턴.

import {
  mapNaverFitLabel,
  lookupFitFromProductAttributes,
  type NaverCategoryDict,
} from "../../src/lib/seo/naver-attribute-dict"
import {
  extractFitFromTags,
  extractFitFromDescription,
} from "../../src/lib/seo/description-parser"

let failed = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = got === want
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got=${String(got)}, want=${String(want)})`)
  if (!ok) failed++
}

// --- 1. mapNaverFitLabel: Phase 0' 실측 블라우스 핏 라벨 5종 ---
eq("label 슬림핏", mapNaverFitLabel("슬림핏"), "SLIM")
eq("label 기본핏", mapNaverFitLabel("기본핏"), "REGULAR")
eq("label 루즈핏/오버핏 → LOOSE (PM)", mapNaverFitLabel("루즈핏/오버핏"), "LOOSE")
eq("label 머슬핏 → null", mapNaverFitLabel("머슬핏"), null)
eq("label 기타 → null", mapNaverFitLabel("기타"), null)
// 다른 카테고리 가정 라벨
eq("label 와이드핏 → WIDE", mapNaverFitLabel("와이드핏"), "WIDE")
eq("label 스트레이트 → STRAIGHT", mapNaverFitLabel("스트레이트핏"), "STRAIGHT")
eq("label 크롭 → CROPPED", mapNaverFitLabel("크롭"), "CROPPED")

// --- 2. lookupFitFromProductAttributes: 실측 블라우스 dict + 캡처된 productAttributes ---
const blouseDict: NaverCategoryDict = new Map([
  [
    10011015,
    {
      attributeSeq: 10011015,
      attributeName: "핏",
      classificationType: "SINGLE_SELECT",
      values: new Map([
        [10040058, "슬림핏"],
        [10040059, "기본핏"],
        [10904155, "루즈핏/오버핏"],
        [11439691, "머슬핏"],
        [10030656, "기타"],
      ]),
    },
  ],
])
// 실제 캡처된 블라우스 productAttributes (핏=10040059=기본핏)
const blousePA = [
  { attributeSeq: 10011015, attributeValueSeq: 10040059 },
  { attributeSeq: 10012483, attributeValueSeq: 10574775 },
]
eq("blouse productAttributes → REGULAR", lookupFitFromProductAttributes(blousePA, blouseDict), "REGULAR")
eq(
  "slim productAttributes → SLIM",
  lookupFitFromProductAttributes([{ attributeSeq: 10011015, attributeValueSeq: 10040058 }], blouseDict),
  "SLIM",
)
eq(
  "muscle productAttributes → null (fallback)",
  lookupFitFromProductAttributes([{ attributeSeq: 10011015, attributeValueSeq: 11439691 }], blouseDict),
  null,
)
// 가방: 핏 attribute 없는 dict → null
const bagDict: NaverCategoryDict = new Map([
  [10011143, { attributeSeq: 10011143, attributeName: "가방종류", classificationType: "SINGLE_SELECT", values: new Map() }],
])
eq(
  "bag (no 핏 attr) → null",
  lookupFitFromProductAttributes([{ attributeSeq: 10011143, attributeValueSeq: 10769409 }], bagDict),
  null,
)

// --- 3. 정규식 정정: 단독 키워드 false positive 제거 확인 ---
eq("desc '슬림 블라우스' → null (단독 슬림)", extractFitFromDescription("슬림한 블라우스"), null)
eq("desc '슬림핏' → SLIM", extractFitFromDescription("이 옷은 슬림핏 입니다"), "SLIM")
eq("desc '와이드 팬츠' → null (단독 와이드)", extractFitFromDescription("와이드 팬츠"), null)
eq("desc '와이드핏' → WIDE", extractFitFromDescription("와이드핏 팬츠"), "WIDE")
eq("desc '크롭티' → null (단독 크롭)", extractFitFromDescription("크롭티 입니다"), null)
eq("desc '오버사이즈' → OVERSIZED", extractFitFromDescription("오버사이즈 핏"), "OVERSIZED")

// --- 4. extractFitFromTags: sellerTags ---
eq("tags ['슬림핏블라우스'] → SLIM", extractFitFromTags(["슬림핏블라우스", "여름블라우스"]), "SLIM")
eq("tags ['여리핏블라우스'] → null (→ Layer3 REGULAR)", extractFitFromTags(["여리핏블라우스", "하객룩"]), null)
eq("tags [] → null", extractFitFromTags([]), null)

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`)
process.exit(failed === 0 ? 0 : 1)
