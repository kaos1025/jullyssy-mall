-- =============================================
-- GSC 검색성과 일별 스냅샷 cron 등록 (pg_cron + pg_net → Vercel Node 라우트)
-- =============================================
-- 매일 09:00 UTC (= 02:00 PT, GSC PT 일 경계 이후) /api/cron/gsc-sync 호출로
-- Google Search Console 검색성과 일별 스냅샷을 gsc_daily_snapshots 테이블에 적재.
-- 044_shipping_poll_cron(pg_cron + pg_net → HTTP) 패턴 미러. 차이: 대상이 배송 폴링이 아니라
-- GSC API 측정 루프(클릭·노출·CTR·순위 일별 수집 → SEO 개선 피드백 루프).
--
-- ⚠️ apply 보류 — 운영자 검토 후 적용
--
-- 적용 전제 (미충족 상태로 적용하면 cron은 등록되나 호출이 401 — 안전):
--   1. /api/cron/gsc-sync 라우트 운영 배포 + CSRF 면제.
--   2. Vercel env CRON_SECRET 설정 (라우트 인바운드 인증).
--   3. vault.secrets 'gsc_sync_auth' = 'Bearer <CRON_SECRET 동일값>' 외부 1회 등록
--      (vault 평문은 마이그레이션에 금지 → 외부에서 1회. 044 shipping_poll_auth 와 동일 패턴).
--      예) select vault.create_secret('Bearer xxxxx', 'gsc_sync_auth');
--   4. GSC Phase 0 완료: 서비스 계정에 GSC 속성 Owner 권한 부여 +
--      Vercel env GSC_SITE_URL / GOOGLE_SA_* 설정.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('gsc-sync-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'gsc-sync-daily',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jullyssy.shop/api/cron/gsc-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gsc_sync_auth' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
