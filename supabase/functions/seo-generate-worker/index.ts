// SEO 생성 worker — seo_generation_queue에서 pending 작업을 처리.
//
// 호출: pg_cron → pg_net.http_post (1분 주기) 또는 수동 invoke.
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//   ANTHROPIC_API_KEY (manual: supabase secrets set, live 모드만)
//   SEO_AI_MODE = "mock" | "live" (default: "mock")
//
// 처리 흐름:
//   1. seo_generation_queue WHERE status='pending' ORDER BY scheduled_at LIMIT 10
//   2. status='processing' 갱신
//   3. 각 row: products + categories + product_images 상위 3장 URL 조회
//      → Anthropic Vision API에 URL 직접 전달 (서버 사이드 fetch + resize)
//      → seo_metadata_drafts insert (status='pending_review')
//   4. queue status='completed' 또는 'failed'(retry_count >= 3) 갱신
//
// Phase 1 B-2 학습: @jsquash WASM은 Supabase Edge resource limit 초과.
// Anthropic Vision API source.type="url"이 네이버 pstatic 직접 처리 가능 확인.
// → 클라이언트 사이드 이미지 처리 제거, 인프라 단순화.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { generateSeoMetadata, type ImageInput } from "../_shared/seo/ai-client.ts";
import { extractSpecMetadata } from "../_shared/seo/description-parser.ts";
import type { DescriptionMode } from "../_shared/seo/prompts.ts";

const BATCH_SIZE = 10;
const MAX_RETRY = 3;
const TOP_IMAGES = 3;

interface QueueRow {
  id: string;
  product_id: string;
  retry_count: number;
  trigger_source: string;
  /** D3 PoC — 큐 row의 description 정책. DB default 'preserve' (회귀 0). */
  description_mode: DescriptionMode;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  description: string | null;
  category_id: string | null;
}

interface ProductImageRow {
  id: string;
  url: string;
  sort_order: number;
}

interface CategoryRow {
  name: string;
}

async function processQueueRow(
  supabase: ReturnType<typeof createClient>,
  row: QueueRow,
  mode: "mock" | "live",
  apiKey: string | undefined,
): Promise<{ ok: boolean; error?: string }> {
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, name, price, description, category_id")
    .eq("id", row.product_id)
    .single<ProductRow>();
  if (pErr || !product) {
    return { ok: false, error: `product not found: ${pErr?.message ?? "null"}` };
  }

  let categoryName: string | null = null;
  if (product.category_id) {
    const { data: cat } = await supabase
      .from("categories")
      .select("name")
      .eq("id", product.category_id)
      .single<CategoryRow>();
    categoryName = cat?.name ?? null;
  }

  const { data: images, error: iErr } = await supabase
    .from("product_images")
    .select("id, url, sort_order")
    .eq("product_id", row.product_id)
    .order("sort_order", { ascending: true })
    .limit(TOP_IMAGES)
    .returns<ProductImageRow[]>();
  if (iErr) {
    return { ok: false, error: `images query failed: ${iErr.message}` };
  }

  const topImages = (images ?? []).map<ImageInput>((img) => ({
    imageIndex: img.sort_order,
    url: img.url,
  }));

  // D3 PoC — replace mode 시 description plain text + spec hint 사전 추출.
  // preserve mode는 둘 다 무시되므로 추출 자체 생략 (회귀 0).
  const descMode: DescriptionMode = row.description_mode ?? "preserve";
  const descriptionPlainText =
    descMode === "replace" && product.description
      ? product.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)
      : null;
  const specHint =
    descMode === "replace" && product.description
      ? extractSpecMetadata(product.description)
      : null;

  const draft = await generateSeoMetadata({
    product: {
      name: product.name,
      categoryName,
      basePrice: product.price,
      description: product.description,
    },
    images: topImages,
    mode,
    apiKey,
    descriptionMode: descMode,
    descriptionPlainText,
    specMetadataHint: specHint,
  });

  const { error: insertErr } = await supabase.from("seo_metadata_drafts").insert({
    product_id: product.id,
    status: "pending_review",
    meta_title: draft.metaTitle,
    meta_description: draft.metaDescription,
    search_tags: draft.searchTags,
    image_alt_texts: draft.imageAltTexts,
    model: draft.model,
    prompt_version: draft.promptVersion,
    category_hint: categoryName,
    cost_usd: draft.costUsd,
    tokens_input: draft.tokensInput,
    tokens_output: draft.tokensOutput,
    image_count: draft.imageCount,
    // D3 PoC — replace mode 시 description_mode='replace' + spec_metadata +
    // product_description 저장. preserve mode는 모두 default/NULL (회귀 0).
    description_mode: descMode,
    spec_metadata: draft.specMetadata ?? null,
    product_description: draft.productDescription ?? null,
  });
  if (insertErr) {
    return { ok: false, error: `draft insert failed: ${insertErr.message}` };
  }
  return { ok: true };
}

async function handle(): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return Response.json(
      { ok: false, error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing" },
      { status: 500 },
    );
  }
  const mode = (Deno.env.get("SEO_AI_MODE") ?? "mock") as "mock" | "live";
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (mode === "live" && !apiKey) {
    return Response.json(
      { ok: false, error: "ANTHROPIC_API_KEY required for live mode" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: pending, error: qErr } = await supabase
    .from("seo_generation_queue")
    .select("id, product_id, retry_count, trigger_source, description_mode")
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE)
    .returns<QueueRow[]>();
  if (qErr) {
    return Response.json({ ok: false, error: qErr.message }, { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return Response.json({ ok: true, picked: 0, mode });
  }

  const ids = pending.map((r) => r.id);
  await supabase
    .from("seo_generation_queue")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .in("id", ids);

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of pending) {
    try {
      const r = await processQueueRow(supabase, row, mode, apiKey);
      results.push({ id: row.id, ...r });
    } catch (err) {
      results.push({
        id: row.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const r of results) {
    const row = pending.find((p) => p.id === r.id)!;
    if (r.ok) {
      await supabase
        .from("seo_generation_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", r.id);
    } else {
      const nextRetry = row.retry_count + 1;
      const finalStatus = nextRetry >= MAX_RETRY ? "failed" : "pending";
      await supabase
        .from("seo_generation_queue")
        .update({
          status: finalStatus,
          retry_count: nextRetry,
          error_message: r.error ?? "unknown error",
        })
        .eq("id", r.id);
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return Response.json({
    ok: true,
    mode,
    picked: pending.length,
    succeeded: okCount,
    failed: results.length - okCount,
    results,
  });
}

Deno.serve(async (_req) => {
  try {
    return await handle();
  } catch (err) {
    console.error("[seo-worker] uncaught", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
