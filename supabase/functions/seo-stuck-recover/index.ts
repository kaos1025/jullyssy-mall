// SEO queue stuck recovery — seo_generation_queue.processing 상태에서 N분 경과한 row 복구.
//
// 호출: pg_cron → pg_net.http_post (5분 주기) — 마이그레이션 030.
// 환경변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//   SEO_STUCK_TIMEOUT_MIN (default: 5)
//   SEO_STUCK_MAX_RETRY  (default: 3)
//
// 처리:
//   1. status='processing' AND started_at < NOW() - SEO_STUCK_TIMEOUT_MIN 인 row 검색
//   2. retry_count < SEO_STUCK_MAX_RETRY → status='pending' 복구 + retry_count++ + started_at=NULL
//   3. retry_count >= SEO_STUCK_MAX_RETRY → status='failed' + failed_at + last_error
//
// Sentry 통합 보류: Sentry/Deno SDK 미통합 (Phase 3 Track A-2 보류 항목, spec v0.7).
// 현 단계는 console.warn/error로 supabase function log에 기록. v0.7에서 Sentry captureMessage/Exception 교체.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const DEFAULT_TIMEOUT_MIN = 5;
const DEFAULT_MAX_RETRY = 3;

interface StuckRow {
  id: string;
  product_id: string;
  retry_count: number;
  started_at: string | null;
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "missing supabase env" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const timeoutMin = parseInt(
    Deno.env.get("SEO_STUCK_TIMEOUT_MIN") ?? String(DEFAULT_TIMEOUT_MIN),
    10,
  );
  const maxRetry = parseInt(
    Deno.env.get("SEO_STUCK_MAX_RETRY") ?? String(DEFAULT_MAX_RETRY),
    10,
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. stuck row 검색
  const cutoff = new Date(Date.now() - timeoutMin * 60 * 1000).toISOString();
  const { data: stuckRows, error: selectErr } = await supabase
    .from("seo_generation_queue")
    .select("id, product_id, retry_count, started_at")
    .eq("status", "processing")
    .lt("started_at", cutoff);

  if (selectErr) {
    console.error("[seo-stuck-recover] select failed:", selectErr.message);
    // TODO(v0.7): Sentry.captureException(selectErr)
    return new Response(
      JSON.stringify({ error: selectErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const rows = (stuckRows ?? []) as StuckRow[];
  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ recovered: 0, dead_lettered: 0 }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  let recovered = 0;
  let deadLettered = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.retry_count < maxRetry) {
      // retry: status='pending'으로 복구
      const { error: updateErr } = await supabase
        .from("seo_generation_queue")
        .update({
          status: "pending",
          started_at: null,
          retry_count: row.retry_count + 1,
        })
        .eq("id", row.id)
        .eq("status", "processing"); // race 방지: 그 사이 다른 상태 전이 시 no-op
      if (updateErr) {
        errors.push(`${row.id}: ${updateErr.message}`);
        console.error(
          `[seo-stuck-recover] retry update failed ${row.id}:`,
          updateErr.message,
        );
        // TODO(v0.7): Sentry.captureException
        continue;
      }
      recovered += 1;
      console.warn(
        `[seo-stuck-recover] retry ${row.retry_count + 1}/${maxRetry}: ${row.id} (product ${row.product_id})`,
      );
      // TODO(v0.7): Sentry.captureMessage("seo_queue_retry", { level: "warning", tags: { ... } })
    } else {
      // dead-letter
      const { error: updateErr } = await supabase
        .from("seo_generation_queue")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          last_error: `stuck timeout exceeded ${maxRetry} retries`,
        })
        .eq("id", row.id)
        .eq("status", "processing");
      if (updateErr) {
        errors.push(`${row.id}: ${updateErr.message}`);
        console.error(
          `[seo-stuck-recover] dead-letter update failed ${row.id}:`,
          updateErr.message,
        );
        continue;
      }
      deadLettered += 1;
      console.error(
        `[seo-stuck-recover] DEAD-LETTER: ${row.id} (product ${row.product_id})`,
      );
      // TODO(v0.7): Sentry.captureException(new Error("seo_queue_dead_letter"), { ... })
    }
  }

  return new Response(
    JSON.stringify({
      recovered,
      dead_lettered: deadLettered,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
