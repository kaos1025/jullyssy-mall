-- =============================================
-- SEO worker cron 등록 (#48-1 Phase 1 Track B-3)
-- 매 1분마다 seo-generate-worker Edge Function 호출.
--
-- 사전 조건:
--   - 026 마이그레이션 적용 (seo_generation_queue 등 테이블 존재)
--   - seo-generate-worker Edge Function 배포
--   - vault.secrets에 'seo_worker_auth' 항목 존재 (Bearer <service_role JWT>)
--     → 본 마이그레이션 외부에서 1회 등록 (vault는 마이그레이션에 평문 노출 금지).
--
-- 인증: pg_net이 vault.decrypted_secrets에서 Authorization 헤더 조회.
-- 워커가 verify_jwt=true이므로 service_role JWT가 필요.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 기존 schedule이 있으면 제거 (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('seo-worker-every-min');
EXCEPTION WHEN OTHERS THEN
  -- 없으면 무시
  NULL;
END $$;

SELECT cron.schedule(
  'seo-worker-every-min',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://mdtvnbyvhzhbksssyzgl.supabase.co/functions/v1/seo-generate-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seo_worker_auth' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
