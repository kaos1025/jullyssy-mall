// SEO 생성 worker — seo_generation_queue에서 pending 작업을 처리.
//
// 호출: pg_cron → pg_net.http_post (1분 주기) 또는 수동 invoke.
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//   ANTHROPIC_API_KEY (manual: supabase secrets set, live 모드만)
//   SEO_AI_MODE = "mock" | "live" (default: "mock")
//
// 처리 흐름 (SEO-QUEUE-FIX-1 — item 단위 정합):
//   1. seo_generation_queue WHERE status='pending' ORDER BY scheduled_at LIMIT BATCH_SIZE
//   2. 각 row를 개별적으로 순회:
//      a. wall-clock 예산(SAFE_BUDGET_MS) 초과 시 중단 — 미claim row는 pending 유지
//         (다음 1분 tick이 소화). 진행 중 row만 영향.
//      b. race-safe claim: status pending→processing (.select로 확인,
//         그 사이 다른 invoke가 전이한 row는 0행 → skip).
//      c. 멱등성: 이 큐 사이클(created_at >= scheduled_at)에 동일 product+description_mode
//         draft가 이미 있으면 completed 처리 후 생성 skip (retry 중복 draft 방지).
//      d. products + categories + product_images 상위 3장 조회 → Anthropic Vision →
//         seo_metadata_drafts insert (status='pending_review').
//      e. 즉시 queue status='completed' 또는 'failed'/'pending'(retry) 갱신.
//
// 과거 결함(H1): 10건을 일괄 processing 표시 후 배치 말미에 일괄 상태갱신 →
// live 배치가 Edge/pg_net(60s) 시간한계 초과 시 함수 종료로 상태갱신이 통째로 유실 →
// draft는 insert됐으나 queue가 processing에 영구 잔존 + stuck-recover 재처리로 중복 draft.
// → item 단위 claim+즉시 갱신 + 시간가드 + 멱등성으로 근본 차단. stuck-recover는 안전망 유지.
//
// Phase 1 B-2 학습: @jsquash WASM은 Supabase Edge resource limit 초과.
// Anthropic Vision API source.type="url"이 네이버 pstatic 직접 처리 가능 확인.
// → 클라이언트 사이드 이미지 처리 제거, 인프라 단순화.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { generateSeoMetadata, type ImageInput } from "../_shared/seo/ai-client.ts";
import { extractSpecMetadata } from "../_shared/seo/description-parser.ts";
import type { DescriptionMode } from "../_shared/seo/prompts.ts";
import { FIT_TYPE_LABELS, type FitType } from "../_shared/seo/fit-type.ts";

const BATCH_SIZE = 10;
const MAX_RETRY = 3;
const TOP_IMAGES = 3;
// 단일 invoke wall-clock 예산. pg_net timeout(60s)/Edge 한계 이전에 자발적으로 멈춰
// 진행 중 row만 영향받도록 함 (나머지는 pending 유지 → 다음 1분 tick이 소화).
const SAFE_BUDGET_MS = 45_000;

type SupabaseClient = ReturnType<typeof createClient>;

interface QueueRow {
  id: string;
  product_id: string;
  retry_count: number;
  trigger_source: string;
  /** D3 PoC — 큐 row의 description 정책. DB default 'preserve' (회귀 0). */
  description_mode: DescriptionMode;
  /** 큐 적재 시각. 멱등성 검사(이 사이클 draft 존재 여부)의 기준 시각. */
  scheduled_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  description: string | null;
  category_id: string | null;
  fit_type: string;
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
    .select("id, name, price, description, category_id, fit_type")
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

  // v0.8 A-4 — fit_type 한국어 라벨 (replace mode prompt 입력). DB CHECK 보장값 → 직접 lookup.
  const fitTypeLabel = FIT_TYPE_LABELS[product.fit_type as FitType] ?? null;

  const draft = await generateSeoMetadata({
    product: {
      name: product.name,
      categoryName,
      basePrice: product.price,
      description: product.description,
      fitTypeLabel,
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

// queue row를 완료 처리 (item 단위 즉시 갱신).
async function markCompleted(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("seo_generation_queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", id);
  if (error) {
    console.error(`[seo-worker] mark completed failed ${id}:`, error.message);
  }
}

// queue row 실패 처리 — MAX_RETRY 미만이면 pending 복귀(retry), 이상이면 failed(dead-letter).
// error_message는 worker 실패 사유(029 마이그레이션 컨벤션). last_error는 stuck-recover 도메인.
async function markFailure(
  supabase: SupabaseClient,
  id: string,
  retryCount: number,
  errorMsg: string,
): Promise<void> {
  const nextRetry = retryCount + 1;
  const finalStatus = nextRetry >= MAX_RETRY ? "failed" : "pending";
  const patch: Record<string, unknown> = {
    status: finalStatus,
    retry_count: nextRetry,
    error_message: errorMsg,
  };
  if (finalStatus === "failed") {
    patch.failed_at = new Date().toISOString();
  } else {
    // pending 복귀: started_at 초기화 (다음 claim/stuck-recover 정합).
    patch.started_at = null;
  }
  const { error } = await supabase
    .from("seo_generation_queue")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error(`[seo-worker] mark failure failed ${id}:`, error.message);
  }
}

// 이 큐 사이클에서 이미 draft가 생성됐는지 검사 (retry 시 중복 draft 방지).
// scheduled_at 이후 생성된 동일 product+description_mode draft가 있으면 true.
async function draftAlreadyExists(
  supabase: SupabaseClient,
  row: QueueRow,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("seo_metadata_drafts")
    .select("id")
    .eq("product_id", row.product_id)
    .eq("description_mode", row.description_mode)
    .gte("created_at", row.scheduled_at)
    .limit(1);
  if (error) {
    // 멱등성 검사 실패는 비치명적: 생성 진행 (차단보다 안전).
    console.error(`[seo-worker] idempotency check failed ${row.id}:`, error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function handle(): Promise<Response> {
  const startMs = Date.now();

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
    .select("id, product_id, retry_count, trigger_source, description_mode, scheduled_at")
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

  let claimed = 0;
  let succeeded = 0;
  let failed = 0;
  let skippedIdempotent = 0;
  let stoppedEarly = false;

  for (const row of pending) {
    // (a) 시간가드: 남은 예산이 없으면 미claim row는 pending으로 남겨 다음 tick에 위임.
    if (Date.now() - startMs > SAFE_BUDGET_MS) {
      stoppedEarly = true;
      break;
    }

    // (b) race-safe claim: pending → processing. 그 사이 전이됐으면 0행 → skip.
    const { data: claimRows, error: claimErr } = await supabase
      .from("seo_generation_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (claimErr) {
      console.error(`[seo-worker] claim failed ${row.id}:`, claimErr.message);
      continue;
    }
    if (!claimRows || claimRows.length === 0) {
      continue; // 다른 invoke가 이미 claim
    }
    claimed += 1;

    // (c) 멱등성: 이미 이 사이클 draft가 있으면 생성 skip + 완료 처리.
    if (await draftAlreadyExists(supabase, row)) {
      await markCompleted(supabase, row.id);
      skippedIdempotent += 1;
      continue;
    }

    // (d)(e) 생성 + 즉시 상태 갱신.
    let result: { ok: boolean; error?: string };
    try {
      result = await processQueueRow(supabase, row, mode, apiKey);
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (result.ok) {
      await markCompleted(supabase, row.id);
      succeeded += 1;
    } else {
      await markFailure(supabase, row.id, row.retry_count, result.error ?? "unknown error");
      failed += 1;
    }
  }

  return Response.json({
    ok: true,
    mode,
    picked: pending.length,
    claimed,
    succeeded,
    failed,
    skipped_idempotent: skippedIdempotent,
    stopped_early: stoppedEarly,
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
