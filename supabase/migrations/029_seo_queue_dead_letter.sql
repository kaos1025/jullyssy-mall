-- =============================================
-- seo_generation_queue dead-letter 컬럼 (#48-1 Phase 3 Track B-1)
--
-- stuck recovery 로직에서 사용:
--   - failed_at: dead-letter 시점 기록 (MAX_RETRY=3 초과 시)
--   - last_error: stuck timeout 명시 ("stuck timeout exceeded N retries")
--
-- 기존 error_message는 worker 일반 실패 사유로 유지.
-- 둘 다 NULL 가능 (대부분 row는 정상 완료).
-- =============================================

ALTER TABLE seo_generation_queue
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;
