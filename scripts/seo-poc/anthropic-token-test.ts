// Phase 0 C PoC — Anthropic 이미지 토큰 실측
// 실행: deno run --allow-net --allow-env --env-file=.env.local --no-config --no-npm scripts/seo-poc/anthropic-token-test.ts
//
// 방법: 동일 prompt로 (1) 이미지+텍스트 / (2) 텍스트만 2회 호출.
// usage.input_tokens 차이 = 이미지 토큰.
// spec §4 가정 (1568×1568 ≈ 3275 tokens) 검증.

import Anthropic from "https://esm.sh/@anthropic-ai/sdk";
import decodeJpeg from "https://esm.sh/@jsquash/jpeg@1.6.0/decode";
import encodeJpeg from "https://esm.sh/@jsquash/jpeg@1.6.0/encode";
import resize from "https://esm.sh/@jsquash/resize@2.1.0";

const MODEL = "claude-haiku-4-5-20251001";
const SAMPLE_URL =
  "https://shop-phinf.pstatic.net/20260302_17/17724288220697xqsz_JPEG/8607463799813334_62959770.JPG";
const PROMPT = "이미지의 주요 색상 3가지를 한국어 단어로만 답하세요.";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set");
  Deno.exit(1);
}

// 1) Prepare image
console.error("[1/3] preparing image...");
const res = await fetch(SAMPLE_URL, {
  headers: {
    "user-agent":
      "Mozilla/5.0 (compatible; JullyssyMall-SEO-PoC/0.1; +https://jullyssy.com)",
  },
});
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const inputBytes = new Uint8Array(await res.arrayBuffer());
const imageData = await decodeJpeg(inputBytes);
const maxEdge = Math.max(imageData.width, imageData.height);
const ratio = maxEdge > 1568 ? 1568 / maxEdge : 1;
const newW = Math.round(imageData.width * ratio);
const newH = Math.round(imageData.height * ratio);
const resized = ratio === 1
  ? imageData
  : await resize(imageData, { width: newW, height: newH });
const reencoded = await encodeJpeg(resized, { quality: 85 });
const reencodedBytes = new Uint8Array(reencoded);
const base64 = bytesToBase64(reencodedBytes);
console.error(
  `      ${newW}x${newH}, ${reencodedBytes.length} bytes, base64 ${base64.length} chars`,
);

const client = new Anthropic({ apiKey });

// 2) Call 1 — image + text
console.error("[2/3] calling Anthropic with image...");
const t1 = performance.now();
const r1 = await client.messages.create({
  model: MODEL,
  max_tokens: 64,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64 },
      },
      { type: "text", text: PROMPT },
    ],
  }],
});
const t1ms = Math.round(performance.now() - t1);

// 3) Call 2 — text only
console.error("[3/3] calling Anthropic text-only baseline...");
const t2 = performance.now();
const r2 = await client.messages.create({
  model: MODEL,
  max_tokens: 64,
  messages: [{
    role: "user",
    content: [{ type: "text", text: PROMPT }],
  }],
});
const t2ms = Math.round(performance.now() - t2);

const imageTokens = r1.usage.input_tokens - r2.usage.input_tokens;
const specAssumption = 3275;
const variancePct = Math.round(((imageTokens - specAssumption) / specAssumption) * 100);

// 3장 multimodal 상품당 비용 추정
// claude-haiku-4-5 pricing (2026-01 cutoff 기준 공개치) — spec §4 단가 명시 시 그것으로 정정
const HAIKU_INPUT_PER_MTOK_USD = 1.0;
const HAIKU_OUTPUT_PER_MTOK_USD = 5.0;
const TEXT_INPUT_TOKENS_PER_PRODUCT = r2.usage.input_tokens; // text-only baseline
const OUTPUT_TOKENS_PER_PRODUCT = 400; // spec §4 가정 (정확치는 spec 본문 필요)
const inputTokensPerProduct = TEXT_INPUT_TOKENS_PER_PRODUCT + 3 * imageTokens;
const inputCostUsd = (inputTokensPerProduct / 1_000_000) * HAIKU_INPUT_PER_MTOK_USD;
const outputCostUsd = (OUTPUT_TOKENS_PER_PRODUCT / 1_000_000) * HAIKU_OUTPUT_PER_MTOK_USD;
const costPerProductUsd = inputCostUsd + outputCostUsd;
const monthlyCap1000UsdAt20 = 20;
const productsUnderCap = Math.floor(monthlyCap1000UsdAt20 / costPerProductUsd);

console.log(JSON.stringify({
  model: MODEL,
  image: {
    url: SAMPLE_URL,
    dimensions: { width: newW, height: newH },
    bytes: reencodedBytes.length,
    base64_chars: base64.length,
  },
  call_1_with_image: {
    input_tokens: r1.usage.input_tokens,
    output_tokens: r1.usage.output_tokens,
    latency_ms: t1ms,
  },
  call_2_text_only: {
    input_tokens: r2.usage.input_tokens,
    output_tokens: r2.usage.output_tokens,
    latency_ms: t2ms,
  },
  derived_image_tokens: imageTokens,
  spec_assumption_tokens: specAssumption,
  variance_pct: variancePct,
  risk_trigger_plus_20pct: Math.abs(variancePct) > 20,
  cost_estimate: {
    note: "Haiku 4.5 단가는 추정치 ($1/$5 per MTok). spec §4 단가 본문으로 정정 필요.",
    input_tokens_per_product_3_images: inputTokensPerProduct,
    output_tokens_per_product: OUTPUT_TOKENS_PER_PRODUCT,
    cost_per_product_usd: Number(costPerProductUsd.toFixed(6)),
    products_under_20usd_cap: productsUnderCap,
    spec_assumption_1000_products_per_20usd: 1000,
    pass: productsUnderCap >= 1000,
  },
}, null, 2));
