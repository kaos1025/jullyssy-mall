-- =============================================
-- 월 누적 SEO 비용 RPC (#48-1 Phase 3 Track C-2)
-- backfill API 사전 검증 + admin dashboard 카드 둘 다 재사용.
--
-- 동작: 이번 달(date_trunc('month', NOW())) 이후 생성된 모든 draft의 cost_usd 합.
--   - approved + rejected + pending_review + failed 전체 포함 (실비 발생 기준)
--   - mock 모드 draft는 cost_usd=0으로 기록되므로 영향 0
--
-- 보안: STABLE + service_role 전용 grant. admin email whitelist는 API에서 verifyAdmin.
-- =============================================

CREATE OR REPLACE FUNCTION seo_monthly_cost_usd()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)::NUMERIC
  FROM seo_metadata_drafts
  WHERE created_at >= date_trunc('month', NOW());
$$;

REVOKE ALL ON FUNCTION seo_monthly_cost_usd() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seo_monthly_cost_usd() TO service_role;
