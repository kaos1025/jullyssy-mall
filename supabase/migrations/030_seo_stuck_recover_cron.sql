-- =============================================
-- SEO stuck-recover cron 등록 (#48-1 Phase 3 Track B-3)
-- 매 5분마다 seo-stuck-recover Edge Function 호출.
--
-- 사전 조건:
--   - 029 마이그레이션 적용 (failed_at, last_error 컬럼)
--   - seo-stuck-recover Edge Function 배포
--   - vault.secrets에 'seo_worker_auth' 항목 존재 (Phase 1 027에서 등록됨)
--
-- 인증: 027과 동일 — pg_net이 vault.decrypted_secrets에서 조회.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('seo-stuck-recover-every-5-min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'seo-stuck-recover-every-5-min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://mdtvnbyvhzhbksssyzgl.supabase.co/functions/v1/seo-stuck-recover',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seo_worker_auth' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
