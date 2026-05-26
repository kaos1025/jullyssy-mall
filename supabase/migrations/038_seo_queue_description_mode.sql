-- =============================================
-- D3 PoC — seo_generation_queue PoC 컬럼 (#48-1 spec-d3-poc-v0.1 Track C-1)
--
-- worker가 큐 row에서 description_mode를 읽어 ai-client에 전달.
-- backfill API poc_mode=true 시 preserve + replace 2개 row를 큐에 insert.
--
-- description_mode DEFAULT 'preserve' NOT NULL → 기존 큐 row (네이버 임포트 hook,
-- admin /regenerate, admin /backfill 일반 호출) 모두 회귀 risk 0.
-- =============================================

ALTER TABLE seo_generation_queue
  ADD COLUMN IF NOT EXISTS description_mode VARCHAR(16) NOT NULL DEFAULT 'preserve'
    CHECK (description_mode IN ('preserve', 'replace'));
