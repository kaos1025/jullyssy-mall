-- =============================================
-- 상단 프로모 배너 (top_banners)
-- =============================================
-- 헤더 상단 캐러셀에 노출되는 운영용 배너
-- 어드민이 service role로 CRUD, anon은 활성+기간 내만 SELECT

CREATE TABLE top_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 컨텐츠
  emoji TEXT,
  message TEXT NOT NULL,
  link_url TEXT,

  -- 스타일
  variant TEXT NOT NULL DEFAULT 'normal'
    CHECK (variant IN ('normal', 'urgent')),
  bg_color TEXT,
  text_color TEXT,

  -- 운영
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신 (기존 update_updated_at() 함수 재사용)
CREATE TRIGGER top_banners_updated_at
  BEFORE UPDATE ON top_banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 활성 배너 조회 최적화 (partial index)
CREATE INDEX idx_top_banners_active
  ON top_banners (is_active, sort_order)
  WHERE is_active = TRUE;

-- =============================================
-- RLS
-- =============================================
ALTER TABLE top_banners ENABLE ROW LEVEL SECURITY;

-- 누구나(anon 포함) 활성 + 기간 내 배너만 SELECT
CREATE POLICY "top_banners_select_active"
  ON top_banners FOR SELECT
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  );

-- INSERT/UPDATE/DELETE 정책 없음 → 어드민은 service role 클라이언트로 RLS 우회

-- =============================================
-- 시드 (2건, 멱등)
-- =============================================
-- 재실행 시 중복 방지: 테이블이 비어 있을 때만 INSERT
-- 운영 데이터 보존 우선 (이미 데이터가 있으면 시드 스킵)
INSERT INTO top_banners (emoji, message, link_url, variant, sort_order, is_active)
SELECT * FROM (VALUES
  ('🎁', '신규가입 5,000원 쿠폰 즉시 지급', '/coupons', 'normal', 0, TRUE),
  ('🚚', '5만원 이상 무료배송', '/products', 'normal', 1, TRUE)
) AS v(emoji, message, link_url, variant, sort_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM top_banners LIMIT 1);
