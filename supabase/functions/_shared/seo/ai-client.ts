// Anthropic API 클라이언트 + mock 분기.
//
// Runtime: Supabase Edge Function (Deno). esm.sh CDN.
// SEO_AI_MODE=mock: 호출 생략, fixture 반환 (cost_usd=0).
// SEO_AI_MODE=live: Anthropic API 호출. retry 3회.
//
// Phase 1 B-2 detour 학습 (2026-05-19): Anthropic Vision API의 source.type="url"이
// 네이버 pstatic 직접 fetch + 서버사이드 resize를 처리하므로 클라이언트 이미지 처리 불필요.
// 토큰 1533~1543 (Phase 0 manual resize 1551 대비 ±1%), 비용 $0.0066/3장.
// → @jsquash 의존성 제거. ImageInput은 URL만 보관.

// @ts-ignore
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";
import {
  PROMPT_VERSION,
  PROMPT_VERSION_REPLACE,
  SEO_METADATA_TOOL,
  SEO_METADATA_TOOL_REPLACE,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_REPLACE,
  USER_PROMPT_TEMPLATE,
  USER_PROMPT_TEMPLATE_REPLACE,
} from "./prompts.ts";
import type { DescriptionMode } from "./prompts.ts";
import type { SpecMetadata } from "./description-parser.ts";

export const MODEL_ID = "claude-haiku-4-5-20251001";

// Haiku 4.5 pricing (input $1 / output $5 per MTok 가정 — spec §4 본문 명시 시 정정).
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

export interface ProductInput {
  name: string;
  categoryName: string | null;
  basePrice: number;
  description: string | null;
}

export interface ImageInput {
  /** image_index (0-based sort_order asc) */
  imageIndex: number;
  /** 원본 이미지 URL (네이버 pstatic 등). Anthropic이 직접 fetch + resize. */
  url: string;
}

export interface SeoDraftResult {
  metaTitle: string;
  metaDescription: string;
  searchTags: string[];
  imageAltTexts: Array<{ image_index: number; alt_text: string }>;
  model: string;
  promptVersion: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  imageCount: number;
  /** D3 PoC — replace mode 결과 추가 필드 (preserve 시 undefined). */
  descriptionMode?: DescriptionMode;
  productDescription?: string;
  specMetadata?: SpecMetadata;
}

function mockResponse(product: ProductInput, images: ImageInput[]): SeoDraftResult {
  const name = product.name.slice(0, 30);
  return {
    metaTitle: `${name} | 쥴리씨`.slice(0, 60),
    metaDescription: `${name}. 데일리 캐주얼로 무난하게 매치하기 좋은 아이템. 쥴리씨에서 만나보세요.`.slice(0, 155),
    searchTags: ["여성의류", "데일리룩", "캐주얼", "쥴리씨", "여성패션"],
    imageAltTexts: images.map((img, i) => ({
      image_index: img.imageIndex,
      alt_text: `${name} 메인컷 ${i + 1}`.slice(0, 30),
    })),
    model: `${MODEL_ID} (mock)`,
    promptVersion: PROMPT_VERSION,
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    imageCount: images.length,
  };
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: unknown;
}

interface AnthropicMessage {
  content: Array<AnthropicToolUseBlock | { type: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

async function callAnthropic(
  client: { messages: { create: (req: unknown) => Promise<AnthropicMessage> } },
  product: ProductInput,
  images: ImageInput[],
): Promise<SeoDraftResult> {
  const userPrompt = USER_PROMPT_TEMPLATE({
    productName: product.name,
    categoryName: product.categoryName,
    basePrice: product.basePrice,
    description: product.description,
    imageCount: images.length,
  });

  const content: Array<
    | { type: "image"; source: { type: "url"; url: string } }
    | { type: "text"; text: string }
  > = [];
  for (const img of images) {
    content.push({
      type: "image",
      source: { type: "url", url: img.url },
    });
  }
  content.push({ type: "text", text: userPrompt });

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: [SEO_METADATA_TOOL],
        tool_choice: { type: "tool", name: SEO_METADATA_TOOL.name },
        messages: [{ role: "user", content }],
      });

      const toolUse = res.content.find(
        (b): b is AnthropicToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) throw new Error("Anthropic response missing tool_use block");
      const input = toolUse.input as {
        meta_title: string;
        meta_description: string;
        search_tags: string[];
        image_alt_texts: Array<{ image_index: number; alt_text: string }>;
      };

      const costUsd =
        (res.usage.input_tokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
        (res.usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK;

      return {
        metaTitle: input.meta_title,
        metaDescription: input.meta_description,
        searchTags: input.search_tags,
        imageAltTexts: input.image_alt_texts,
        model: MODEL_ID,
        promptVersion: PROMPT_VERSION,
        tokensInput: res.usage.input_tokens,
        tokensOutput: res.usage.output_tokens,
        costUsd: Number(costUsd.toFixed(6)),
        imageCount: images.length,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function generateSeoMetadata(input: {
  product: ProductInput;
  images: ImageInput[];
  mode: "mock" | "live";
  apiKey?: string;
  /** D3 PoC — default 'preserve' (회귀 0). 'replace' 시 신규 prompt + spec 분리. */
  descriptionMode?: DescriptionMode;
  /** D3 PoC — replace mode 시 임포트 HTML의 plain text. preserve mode는 무시. */
  descriptionPlainText?: string | null;
  /** D3 PoC — replace mode 시 description-parser가 추출한 spec hint. preserve mode는 무시. */
  specMetadataHint?: SpecMetadata | null;
}): Promise<SeoDraftResult> {
  const descMode: DescriptionMode = input.descriptionMode ?? "preserve";

  // preserve mode — 기존 호출 경로 byte-level 동일 (회귀 0)
  if (descMode === "preserve") {
    if (input.mode === "mock") return mockResponse(input.product, input.images);
    if (!input.apiKey) throw new Error("ANTHROPIC_API_KEY required for live mode");
    const client = new Anthropic({ apiKey: input.apiKey });
    return callAnthropic(client, input.product, input.images);
  }

  // replace mode — D3 PoC 신규 경로
  const plainText = input.descriptionPlainText ?? null;
  const specHint = input.specMetadataHint ?? null;
  if (input.mode === "mock") {
    return mockResponseReplace(input.product, input.images, plainText, specHint);
  }
  if (!input.apiKey) throw new Error("ANTHROPIC_API_KEY required for live mode");
  const client = new Anthropic({ apiKey: input.apiKey });
  return callAnthropicReplace(client, input.product, input.images, plainText, specHint);
}

// =============================================================================
// D3 PoC — replace mode 분기 (spec-48-1-d3-poc-v0.1 Track C-2)
//
// 회귀 0 원칙: 위 mockResponse / callAnthropic 함수는 byte-level invariant.
// 아래 *_Replace 변형은 add-only. PoC trigger 시에만 호출.
// =============================================================================

function mockResponseReplace(
  product: ProductInput,
  images: ImageInput[],
  descriptionPlainText: string | null,
  specMetadataHint: SpecMetadata | null,
): SeoDraftResult {
  const name = product.name.slice(0, 30);
  const baseDesc = descriptionPlainText
    ? `${descriptionPlainText.slice(0, 150)} 자사몰에서 새로 만나보세요. 데일리 코디부터 외출 룩까지 활용도가 높습니다.`
    : `${name}. 데일리 캐주얼로 무난하게 매치하기 좋은 아이템. 자사몰에서 만나보세요.`;
  return {
    metaTitle: `${name} | 쥴리씨`.slice(0, 60),
    metaDescription: `${name}. 데일리 캐주얼로 무난하게 매치하기 좋은 아이템. 쥴리씨에서 만나보세요.`.slice(0, 155),
    searchTags: ["여성의류", "데일리룩", "캐주얼", "쥴리씨", "여성패션"],
    imageAltTexts: images.map((img, i) => ({
      image_index: img.imageIndex,
      alt_text: `${name} 메인컷 ${i + 1}`.slice(0, 30),
    })),
    model: `${MODEL_ID} (mock)`,
    promptVersion: PROMPT_VERSION_REPLACE,
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    imageCount: images.length,
    descriptionMode: "replace",
    productDescription: baseDesc.slice(0, 400),
    specMetadata: specMetadataHint ?? {},
  };
}

interface ReplaceToolInput {
  meta_title: string;
  meta_description: string;
  search_tags: string[];
  image_alt_texts: Array<{ image_index: number; alt_text: string }>;
  product_description: string;
  spec_metadata: SpecMetadata;
}

async function callAnthropicReplace(
  client: { messages: { create: (req: unknown) => Promise<AnthropicMessage> } },
  product: ProductInput,
  images: ImageInput[],
  descriptionPlainText: string | null,
  specMetadataHint: SpecMetadata | null,
): Promise<SeoDraftResult> {
  const userPrompt = USER_PROMPT_TEMPLATE_REPLACE({
    productName: product.name,
    categoryName: product.categoryName,
    basePrice: product.basePrice,
    descriptionPlainText,
    specMetadataHint,
    imageCount: images.length,
  });

  const content: Array<
    | { type: "image"; source: { type: "url"; url: string } }
    | { type: "text"; text: string }
  > = [];
  for (const img of images) {
    content.push({
      type: "image",
      source: { type: "url", url: img.url },
    });
  }
  content.push({ type: "text", text: userPrompt });

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 2048,
        system: SYSTEM_PROMPT_REPLACE,
        tools: [SEO_METADATA_TOOL_REPLACE],
        tool_choice: { type: "tool", name: SEO_METADATA_TOOL_REPLACE.name },
        messages: [{ role: "user", content }],
      });

      const toolUse = res.content.find(
        (b): b is AnthropicToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) throw new Error("Anthropic response missing tool_use block");
      const input = toolUse.input as ReplaceToolInput;

      const costUsd =
        (res.usage.input_tokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
        (res.usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK;

      return {
        metaTitle: input.meta_title,
        metaDescription: input.meta_description,
        searchTags: input.search_tags,
        imageAltTexts: input.image_alt_texts,
        model: MODEL_ID,
        promptVersion: PROMPT_VERSION_REPLACE,
        tokensInput: res.usage.input_tokens,
        tokensOutput: res.usage.output_tokens,
        costUsd: Number(costUsd.toFixed(6)),
        imageCount: images.length,
        descriptionMode: "replace",
        productDescription: input.product_description,
        specMetadata: input.spec_metadata,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
