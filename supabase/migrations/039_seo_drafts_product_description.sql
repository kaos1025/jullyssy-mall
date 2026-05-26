-- =============================================
-- D3 PoC — seo_metadata_drafts.product_description (#48-1 spec-d3-poc-v0.1 Track D-0)
--
-- Track C 누락 보강:
-- ai-client (replace mode)가 product_description (200~400자 자연어 본문)을 반환하나,
-- 037에는 description_mode + spec_metadata만 추가되어 저장 컬럼 부재.
-- 039로 product_description TEXT NULL 컬럼 추가.
--
-- preserve mode (default) 시 NULL 유지 → 기존 row + 기존 호출 회귀 0.
-- =============================================

ALTER TABLE seo_metadata_drafts
  ADD COLUMN IF NOT EXISTS product_description TEXT NULL;
