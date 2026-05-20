// Vercel Node runtime용 ensureImgAlts 단위 테스트 (Phase 2 Track C-2).
//
// 실행: npx tsx scripts/seo-poc/description-parser-node-test.ts
//
// 검증 목적:
// 1. ensureImgAlts(null/undefined/"") no-op 보존 (description NULL 케이스)
// 2. 빈 alt 일괄 삽입 (decorative)
// 3. 기존 alt 보존
// 4. AI alt 주입 (injections 배열)
// 5. overwriteExisting 옵션
//
// vitest 미도입 — 임시 스크립트 (명세 자율 영역).

import {
  ensureImgAlts,
  injectAltTexts,
} from "../../src/lib/seo/description-parser"

let failed = 0
const test = (name: string, expr: boolean): void => {
  if (expr) {
    console.log(`PASS  ${name}`)
  } else {
    console.error(`FAIL  ${name}`)
    failed += 1
  }
}

// node-html-parser는 빈 attribute를 HTML5 boolean 스타일 `alt` (no value)로 직렬화.
// `alt=""` 와 `alt` 는 HTML5 사양상 동등 (SEO/접근성 영향 0).
// 두 형태 모두 매칭하는 regex.
const EMPTY_ALT_RE = /alt(?:=""|(?=[\s>]))/g
const countEmptyAlts = (html: string): number =>
  (html.match(EMPTY_ALT_RE) ?? []).length

// 1. null-safe
test("ensureImgAlts(null) === null", ensureImgAlts(null) === null)
test("ensureImgAlts(undefined) === null", ensureImgAlts(undefined) === null)
test("ensureImgAlts('') === ''", ensureImgAlts("") === "")

// 2. 빈 alt 일괄 삽입 (decorative)
const html1 = '<p><img src="a"><img src="b"></p>'
const out1 = ensureImgAlts(html1) ?? ""
test("img 2개 모두 빈 alt 삽입", countEmptyAlts(out1) === 2)

// 3. 기존 alt 보존
const html2 = '<p><img src="a" alt="kept"><img src="b"></p>'
const out2 = ensureImgAlts(html2) ?? ""
test("기존 alt='kept' 보존", out2.includes('alt="kept"'))
test("alt 없던 img는 빈 alt 삽입", countEmptyAlts(out2) === 1)

// 4. AI alt 주입 (injections 배열)
const html3 = '<p><img src="a"><img src="b"></p>'
const out3 =
  ensureImgAlts(html3, [{ imageIndex: 0, altText: "First image" }]) ?? ""
test('첫 img에 AI alt "First image" 주입', out3.includes('alt="First image"'))
test("두 번째 img는 injection 없으면 빈 alt", countEmptyAlts(out3) === 1)

// 5. overwriteExisting 옵션
const html4 = '<p><img src="a" alt="old"></p>'
const out4 =
  ensureImgAlts(
    html4,
    [{ imageIndex: 0, altText: "new" }],
    { overwriteExisting: true },
  ) ?? ""
test('overwriteExisting=true 시 alt="old" → "new" 덮어쓰기', out4.includes('alt="new"'))

// 6. injectAltTexts 반환 통계
const r = injectAltTexts(
  '<p><img src="a"><img src="b"></p>',
  [{ imageIndex: 0, altText: "x" }],
)
test("injectAltTexts.injected === 1", r.injected === 1)
test("injectAltTexts.totalImages === 2", r.totalImages === 2)
test("injectAltTexts.preserved === 0", r.preserved === 0)

// 7. img 없는 HTML
const html7 = "<p>hello</p>"
const out7 = ensureImgAlts(html7) ?? ""
test("img 없는 HTML은 그대로 통과", out7.includes("hello"))

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log("\nAll tests passed")
