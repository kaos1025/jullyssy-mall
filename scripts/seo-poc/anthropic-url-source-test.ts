// Phase 1 detour PoC — Anthropic Vision source.type="url" 직접 전달 검증.
// 실행: deno run --allow-net --allow-env --env-file=.env.local --no-config --no-npm scripts/seo-poc/anthropic-url-source-test.ts
//
// 목표: 네이버 pstatic 이미지 URL을 Anthropic Vision API가 직접 fetch + 처리 가능한지 확인.
// 성공 시: @jsquash 제거 + Edge Function에서 이미지 처리 자체 불필요 → spec v0.5 minor

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";

const MODEL = "claude-haiku-4-5-20251001";
const PROMPT = "이미지의 주요 색상 3가지를 한국어 단어로만 답하세요.";

const IMAGES = [
  { label: "small 649KB", url: "https://shop-phinf.pstatic.net/20260204_177/17701888028237Ddgf_JPEG/80319264492815258_429174183.jpg" },
  { label: "medium 3.1MB", url: "https://shop-phinf.pstatic.net/20260302_64/1772426885407JjQXu_JPEG/22399238468721405_590933220.JPG" },
  { label: "large 3.1MB", url: "https://shop-phinf.pstatic.net/20260223_271/1771815195192m6LcL_JPEG/105948008405786677_113316752.JPG" },
];

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set");
  Deno.exit(1);
}

const client = new Anthropic({ apiKey });

const results: Array<Record<string, unknown>> = [];

for (const img of IMAGES) {
  console.error(`[${img.label}] calling Anthropic with URL source...`);
  const t0 = performance.now();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 64,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: img.url } },
          { type: "text", text: PROMPT },
        ],
      }],
    });
    const latencyMs = Math.round(performance.now() - t0);
    const text = res.content.find((b: { type: string }) => b.type === "text");
    results.push({
      label: img.label,
      url: img.url,
      ok: true,
      latency_ms: latencyMs,
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      response_text: (text as { text?: string })?.text?.slice(0, 100),
    });
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    results.push({
      label: img.label,
      url: img.url,
      ok: false,
      latency_ms: latencyMs,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Text-only baseline (이미지 토큰 차이 계산용)
console.error("[baseline] text-only...");
const t0 = performance.now();
const baseline = await client.messages.create({
  model: MODEL,
  max_tokens: 64,
  messages: [{ role: "user", content: [{ type: "text", text: PROMPT }] }],
});
const baselineMs = Math.round(performance.now() - t0);

console.log(JSON.stringify({
  model: MODEL,
  source_type: "url",
  baseline_text_only_tokens: baseline.usage.input_tokens,
  baseline_latency_ms: baselineMs,
  results,
  cost_estimate_per_image_usd: results
    .filter((r) => r.ok)
    .map((r) => ({
      label: r.label,
      image_tokens: (r.input_tokens as number) - baseline.usage.input_tokens,
      cost_3_images_usd_haiku45: Number((((((r.input_tokens as number) - baseline.usage.input_tokens) * 3 + baseline.usage.input_tokens) / 1_000_000) * 1.0 + (400 / 1_000_000) * 5.0).toFixed(6)),
    })),
}, null, 2));
