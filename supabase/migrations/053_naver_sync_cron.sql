-- =============================================
-- 네이버 스마트스토어 재고/품절/상태 동기화 cron 등록 (pg_cron + pg_net → Vercel Node 라우트)
-- =============================================
-- 매시 정각 /api/cron/naver-sync 호출로 네이버 임포트 상품의 재고/품절/상태를
-- 스마트스토어와 동기화(오버셀 방지). 가격은 동기화 안 함(자사몰 차별화 보존).
-- 052(gsc) / 044(shipping) 패턴 미러.
--
-- ⚠️ apply 보류 — 운영자 검토 후 적용
--
-- 적용 전제 (미충족 상태로 적용하면 cron은 등록되나 호출이 401 — 안전):
--   1. /api/cron/naver-sync 라우트 운영 배포 + CSRF 면제.
--   2. Vercel env CRON_SECRET 설정 (라우트 인바운드 인증).
--   3. vault.secrets 'naver_sync_auth' = 'Bearer <CRON_SECRET 동일값>' 외부 1회 등록
--      (vault 평문은 마이그레이션에 금지 → 외부에서 1회. 044 shipping_poll_auth 와 동일 패턴).
--      예) select vault.create_secret('Bearer xxxxx', 'naver_sync_auth');
--   4. 네이버 커머스 API env(NAVER_COMMERCE_APP_ID / NAVER_COMMERCE_SECRET) — 이미 설정됨.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('naver-sync-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'naver-sync-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jullyssy.shop/api/cron/naver-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'naver_sync_auth' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000  -- 라우트 wall-clock 예산 70s(상세 throttle/429 재시도) 응답 대기. maxDuration 120s 미만.
  );
  $cron$
);
