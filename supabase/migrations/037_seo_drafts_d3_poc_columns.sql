-- =============================================
-- D3 PoC — seo_metadata_drafts PoC 컬럼 (#48-1 spec-d3-poc-v0.1 Track A-1)
--
-- description 정책 비교 PoC (preserve vs replace) 결과를 데이터로 추적.
--
-- description_mode:
--   'preserve' = v0.6 baseline (description 본문 유지 + alt만 처리)
--   'replace'  = PoC 신규 (스마트스토어 HTML 제거 + AI 자연어 description 생성 + spec 분리)
--
-- spec_metadata:
--   replace mode 시 description-parser가 추출한 spec (size/material/washCare/modelInfo).
--   preserve mode 시 NULL.
--
-- 정리 정책:
--   PoC v0.7 진입 결정 시 컬럼 그대로 유지.
--   PoC close 결정 시 별도 후속 마이그레이션으로 DROP COLUMN.
-- =============================================

ALTER TABLE seo_metadata_drafts
  ADD COLUMN IF NOT EXISTS description_mode VARCHAR(16) NOT NULL DEFAULT 'preserve'
    CHECK (description_mode IN ('preserve', 'replace')),
  ADD COLUMN IF NOT EXISTS spec_metadata JSONB NULL;
