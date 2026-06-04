-- =============================================
-- P1-3-A: 배송 자동완료 폴링 cron 등록 (pg_cron + pg_net → Vercel Node 라우트)
-- =============================================
-- 매시 정각 /api/cron/shipping-poll 호출. SHIPPING + 송장 보유 주문을 Sweet Tracker로
-- 조회해 배송완료 감지 시 DELIVERED 자동 전환(부수효과 SSOT markOrderDelivered 경유).
-- 027_seo_cron(pg_cron + pg_net → HTTP) 패턴 미러. 차이: 대상이 Supabase Edge가 아니라
-- Vercel Node 라우트(Sentry/이메일/status SSOT 재사용 목적).
--
-- ⚠️ 적용 순서 (배포 후 1회):
--   1. /api/cron/shipping-poll 라우트가 운영에 배포되어 있을 것.
--   2. Vercel env에 CRON_SECRET 설정(라우트 인바운드 인증).
--   3. vault.secrets에 'shipping_poll_auth' = 'Bearer <CRON_SECRET 동일값>' 등록
--      (vault 평문은 마이그레이션에 금지 → 외부에서 1회. 027 seo_worker_auth와 동일 패턴).
--      예) select vault.create_secret('Bearer xxxxx', 'shipping_poll_auth');
--   4. 아래 __PROD_DOMAIN__ 을 운영 도메인(NEXT_PUBLIC_SITE_URL 값)으로 치환.
-- 위 1~4 미충족 상태로 적용하면 cron은 등록되나 호출이 401/실패한다(건별 격리·Sentry로 안전).

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('shipping-poll-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'shipping-poll-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://__PROD_DOMAIN__/api/cron/shipping-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'shipping_poll_auth' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
