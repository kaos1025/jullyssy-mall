-- =============================================
-- AI 상품 SEO 자동화 (#48-1) — Phase 0 산출
-- spec-48-1-ai-product-seo-v0.3 §3 그대로 반영.
--
-- 변경점 메모:
-- 1) spec §3 원안의 `ALTER TABLE products ADD COLUMN search_tags TEXT[]`는
--    008_add_search_tags.sql 에서 이미 적용됨 (DEFAULT '{}').
--    중복 ADD 시 "column already exists" 에러 → 본 마이그레이션에서 제외.
--    → spec v0.4 minor 정정 필요 (Phase 0 보고서 §spec 수정에 기록).
-- 2) spec §3 원안의 단일 파일 명 "015_seo_metadata.sql"은 015가 이미
--    015_add_review_tag_columns.sql 로 점유되어 026으로 재번호.
-- =============================================

-- ---------------------------------------------
-- products SEO 컬럼 (search_tags는 008에서 추가됨)
-- ---------------------------------------------
ALTER TABLE products
  ADD COLUMN meta_title TEXT,
  ADD COLUMN meta_description TEXT,
  ADD COLUMN seo_updated_at TIMESTAMPTZ;

-- ---------------------------------------------
-- product_images alt 텍스트
-- ---------------------------------------------
ALTER TABLE product_images
  ADD COLUMN alt_text TEXT;

-- ---------------------------------------------
-- seo_metadata_drafts — AI 생성 초안 (사용자 검토 전)
-- ---------------------------------------------
CREATE TABLE seo_metadata_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'failed')),

  meta_title TEXT,
  meta_description TEXT,
  search_tags TEXT[],
  image_alt_texts JSONB, -- [{image_index, alt_text}], 최대 3개

  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  category_hint TEXT,
  cost_usd NUMERIC(10, 6),
  tokens_input INT,
  tokens_output INT,
  image_count INT, -- 실제 전달된 이미지 수 (0~3)

  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seo_drafts_product ON seo_metadata_drafts(product_id);
CREATE INDEX idx_seo_drafts_status_pending ON seo_metadata_drafts(status)
  WHERE status = 'pending_review';

-- ---------------------------------------------
-- seo_generation_queue — 생성 작업 큐
-- ---------------------------------------------
CREATE TABLE seo_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INT NOT NULL DEFAULT 0,
  trigger_source TEXT NOT NULL, -- 'naver_import', 'manual_regenerate', 'backfill'
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seo_queue_pending ON seo_generation_queue(scheduled_at)
  WHERE status = 'pending';

-- ---------------------------------------------
-- RLS — service_role 전용 (admin client + Edge Function)
-- ---------------------------------------------
ALTER TABLE seo_metadata_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_generation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seo_metadata_drafts_service_role_all" ON seo_metadata_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "seo_generation_queue_service_role_all" ON seo_generation_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);
