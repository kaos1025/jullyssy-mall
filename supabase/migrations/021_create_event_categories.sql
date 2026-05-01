-- =============================================
-- 이벤트 카테고리 (event_categories)
-- =============================================
-- GNB에 노출되는 임시 이벤트 카테고리 칩 (예: 벚꽃놀이코디)
-- 어드민이 service role로 CRUD, anon은 활성+기간 내만 SELECT

CREATE TABLE event_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 컨텐츠
  name TEXT NOT NULL,
  emoji TEXT,
  link_url TEXT NOT NULL,

  -- 스타일 (hex #RRGGBB)
  color TEXT NOT NULL DEFAULT '#FF6B9D',

  -- 운영
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  display_order INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신 (기존 update_updated_at() 함수 재사용)
CREATE TRIGGER event_categories_updated_at
  BEFORE UPDATE ON event_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 활성 이벤트 카테고리 조회 최적화 (partial index)
CREATE INDEX idx_event_categories_active
  ON event_categories (is_active, display_order)
  WHERE is_active = TRUE;

-- =============================================
-- RLS
-- =============================================
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- 누구나(anon 포함) 활성 + 기간 내 카테고리만 SELECT
CREATE POLICY "event_categories_select_active"
  ON event_categories FOR SELECT
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  );

-- INSERT/UPDATE/DELETE 정책 없음 → 어드민은 service role 클라이언트로 RLS 우회
