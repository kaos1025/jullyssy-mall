// Phase 0 B-2 PoC — HTML 파서 검증 (description <img> alt 일괄 삽입)
// 실행: deno run --allow-net --no-config --no-npm scripts/seo-poc/description-parser-test.ts
//
// 검증 포인트:
// 1) node-html-parser Deno 호환 (esm.sh)
// 2) 네이버 SE description (145KB~247KB) 파싱 동작
// 3) <img> 태그 enumerate + alt 일괄 삽입
// 4) 기존 alt 보존 (덮어쓰기 금지)

import { parse } from "https://esm.sh/node-html-parser@7.0.1";

// 인라인 HTML fixture — 네이버 SE 패턴 단순화 (실제 파싱 동작 검증용)
// 케이스: alt 없음 / 빈 alt / 기존 alt 보유 / 자기닫힘 <img />
const FIXTURE_HTML = `
<div class="se-viewer se-theme-default">
  <div class="se-component se-text">
    <p>상품 상세 설명입니다.</p>
  </div>
  <div class="se-component se-image">
    <img src="https://example.com/img1.jpg" />
  </div>
  <div class="se-component se-image">
    <img src="https://example.com/img2.jpg" alt="" />
  </div>
  <div class="se-component se-image">
    <img src="https://example.com/img3.jpg" alt="기존 캡션" />
  </div>
  <div class="se-component se-image">
    <img src="https://example.com/img4.jpg"/>
  </div>
</div>
`;

function injectAltTexts(
  html: string,
  altByIndex: Map<number, string>,
): { html: string; injected: number; preserved: number; total: number } {
  const root = parse(html);
  const imgs = root.querySelectorAll("img");
  let injected = 0;
  let preserved = 0;

  imgs.forEach((img, idx) => {
    const existing = img.getAttribute("alt");
    if (existing && existing.trim() !== "") {
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
    total: imgs.length,
  };
}

// Case 1: fixture
console.log("=== Case 1: fixture ===");
const fixtureAlts = new Map<number, string>([
  [0, "AI 생성 alt 1"],
  [1, "AI 생성 alt 2"],
  [2, "이건 무시되어야 함 (기존 alt 보존)"],
  [3, "AI 생성 alt 4"],
]);
const r1 = injectAltTexts(FIXTURE_HTML, fixtureAlts);
console.log(JSON.stringify({
  total: r1.total,
  injected: r1.injected,
  preserved: r1.preserved,
  expected: { total: 4, injected: 3, preserved: 1 },
  pass: r1.total === 4 && r1.injected === 3 && r1.preserved === 1,
}, null, 2));
console.log("--- HTML diff (img tags) ---");
const after = parse(r1.html).querySelectorAll("img");
after.forEach((img, idx) => {
  console.log(`  [${idx}] src=${img.getAttribute("src")?.split("/").pop()} alt="${img.getAttribute("alt") ?? "(none)"}"`);
});

// Case 2: 실제 DB sample 파싱 (외부에서 받은 description 가정)
// 여기선 fetch 안 하고 fixture가 SE 패턴이라는 점만 검증.
// 실제 145KB description은 supabase MCP 결과로 별도 검증.
console.log("\n=== Case 2: 빈 HTML 안전성 ===");
const r2 = injectAltTexts("", new Map());
console.log(JSON.stringify({ total: r2.total, injected: r2.injected, preserved: r2.preserved, pass: r2.total === 0 }, null, 2));

console.log("\n=== Case 3: 모든 img에 기존 alt 있음 (덮어쓰기 금지 검증) ===");
const noOverwriteHtml = `<div><img src="a.jpg" alt="A"/><img src="b.jpg" alt="B"/></div>`;
const r3 = injectAltTexts(noOverwriteHtml, new Map([[0, "X"], [1, "Y"]]));
console.log(JSON.stringify({
  total: r3.total,
  injected: r3.injected,
  preserved: r3.preserved,
  expected: { total: 2, injected: 0, preserved: 2 },
  pass: r3.total === 2 && r3.injected === 0 && r3.preserved === 2,
  resulting_html: r3.html,
}, null, 2));
