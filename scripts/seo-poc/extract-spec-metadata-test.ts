// extractSpecMetadata 단위 테스트 (D3 PoC Track B-2).
//
// 실행: npx tsx scripts/seo-poc/extract-spec-metadata-test.ts
//
// 검증 목적:
// 1. null-safe (null/undefined/"" → {})
// 2. table tr 추출 (사이즈/소재/세탁/모델 4개 라벨)
// 3. li colon 패턴 추출
// 4. 정규식 fallback (소재 % 패턴, table/li 없음)
// 5. 빈 HTML (img만) → {}
// 6. 사이즈 토큰 추출 (S/M/L/55/66) vs 단일 fallback
//
// vitest 미도입 — 임시 스크립트 (Track B-2 자율 영역).

import { extractSpecMetadata } from "../../src/lib/seo/description-parser"

let failed = 0
const test = (name: string, expr: boolean): void => {
  if (expr) {
    console.log(`PASS  ${name}`)
  } else {
    console.error(`FAIL  ${name}`)
    failed += 1
  }
}

// 1. null-safe
test("extractSpecMetadata(null) → {}", Object.keys(extractSpecMetadata(null)).length === 0)
test("extractSpecMetadata(undefined) → {}", Object.keys(extractSpecMetadata(undefined)).length === 0)
test("extractSpecMetadata('') → {}", Object.keys(extractSpecMetadata("")).length === 0)

// 2. table tr 4개 라벨 추출
const tableHtml = `
<table>
  <tr><th>사이즈</th><td>S / M / L</td></tr>
  <tr><th>소재</th><td>폴리에스터 95%, 스판덱스 5%</td></tr>
  <tr><th>세탁방법</th><td>드라이클리닝 권장</td></tr>
  <tr><th>모델착장</th><td>모델 신장 168cm, M 사이즈 착용</td></tr>
</table>
`
const tableSpec = extractSpecMetadata(tableHtml)
test("table 사이즈 토큰 추출 (S/M/L)", JSON.stringify(tableSpec.size) === JSON.stringify(["S", "M", "L"]))
test("table 소재 추출", tableSpec.material === "폴리에스터 95%, 스판덱스 5%")
test("table 세탁법 추출", tableSpec.washCare === "드라이클리닝 권장")
test("table 모델정보 추출", tableSpec.modelInfo === "모델 신장 168cm, M 사이즈 착용")

// 3. li colon 패턴
const liHtml = `
<ul>
  <li>사이즈: 55, 66, 77</li>
  <li>소재 : 면 100%</li>
  <li>관리법：30도 손세탁</li>
</ul>
`
const liSpec = extractSpecMetadata(liHtml)
test("li 사이즈 토큰 추출 (55/66/77)", JSON.stringify(liSpec.size) === JSON.stringify(["55", "66", "77"]))
test("li 소재 추출 (반각 colon)", liSpec.material === "면 100%")
test("li 세탁법 추출 (전각 colon)", liSpec.washCare === "30도 손세탁")

// 4. 정규식 fallback (소재 % 패턴, table/li 없음)
const plainHtml = `
<div>
  <p>편안한 핏의 데일리 가디건입니다.</p>
  <p>아크릴 70%, 울 30% 혼방 소재로 따뜻함을 더했습니다.</p>
</div>
`
const plainSpec = extractSpecMetadata(plainHtml)
test("정규식 fallback 소재 추출", plainSpec.material === "아크릴 70%, 울 30%")
test("정규식 fallback 시 사이즈 없음", plainSpec.size === undefined)

// 5. 빈 HTML (img만, spec 없음)
const imgOnlyHtml = '<p><img src="a"><img src="b"></p>'
const imgOnlySpec = extractSpecMetadata(imgOnlyHtml)
test("img만 있는 HTML → {} (정보 손실 0 원칙)", Object.keys(imgOnlySpec).length === 0)

// 6. 사이즈 단일 fallback (토큰 매칭 실패 시 text 전체 slice)
const customSizeHtml = `
<table>
  <tr><th>사이즈</th><td>가슴단면 50cm, 총장 60cm</td></tr>
</table>
`
const customSizeSpec = extractSpecMetadata(customSizeHtml)
test(
  "사이즈 토큰 매칭 실패 → text 전체 slice fallback",
  Array.isArray(customSizeSpec.size) && customSizeSpec.size[0] === "가슴단면 50cm, 총장 60cm",
)

// 7. table + li 혼합 (table 우선, li로 보완)
const mixedHtml = `
<table>
  <tr><th>사이즈</th><td>FREE</td></tr>
</table>
<ul>
  <li>소재: 코튼 100%</li>
</ul>
`
const mixedSpec = extractSpecMetadata(mixedHtml)
test("table 사이즈 (FREE)", JSON.stringify(mixedSpec.size) === JSON.stringify(["FREE"]))
test("li 소재 (table에 없으면 li로 보완)", mixedSpec.material === "코튼 100%")

// 8. table 사이즈가 먼저 매칭되면 li 사이즈는 무시 (중복 방지)
const dupSizeHtml = `
<table>
  <tr><th>사이즈</th><td>S, M</td></tr>
</table>
<ul>
  <li>사이즈: L, XL</li>
</ul>
`
const dupSizeSpec = extractSpecMetadata(dupSizeHtml)
test("table 사이즈 우선 (li 사이즈 무시)", JSON.stringify(dupSizeSpec.size) === JSON.stringify(["S", "M"]))

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log("\nAll tests passed")
