-- =============================================
-- 히어로 배너 (hero_banners)
-- =============================================
-- 홈 메인 비주얼 배너. 운영자가 service role로 CRUD, anon은 활성+기간 내만 SELECT.
-- top_banners(020) 패턴 미러 + hero 특화: 이미지 PC/모바일 분리(필수) + CTA + 노출기간.
-- P1-3-B HERO-BANNER-CRUD

CREATE TABLE hero_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 컨텐츠 (오버레이)
  title TEXT,                          -- 캐치프레이즈
  subtitle TEXT,                       -- 부제목 (선택)
  cta_text TEXT,                       -- 버튼 라벨 (없으면 버튼 숨김)
  cta_link TEXT,                       -- 랜딩 URL (free input, top_banners.link_url 동일)

  -- 비주얼 (PC/모바일 분리 필수)
  image_url_pc TEXT NOT NULL,          -- 데스크탑 비주얼
  image_url_mobile TEXT NOT NULL,      -- 모바일 비주얼

  -- 운영
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,               -- NULL = 상시
  ends_at TIMESTAMPTZ,                 -- NULL = 상시
  sort_order INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신 (기존 update_updated_at() 함수 재사용 — 020 top_banners 동일 패턴)
CREATE TRIGGER hero_banners_updated_at
  BEFORE UPDATE ON hero_banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 활성 배너 조회 최적화 (partial index — 020 top_banners 동일)
CREATE INDEX idx_hero_banners_active
  ON hero_banners (is_active, sort_order)
  WHERE is_active = TRUE;

-- =============================================
-- RLS (top_banners_select_active 정책 복제 — 스펙 §3 USING(true) 대신 활성+기간 필터)
-- =============================================
ALTER TABLE hero_banners ENABLE ROW LEVEL SECURITY;

-- 누구나(anon 포함) 활성 + 기간 내 배너만 SELECT
CREATE POLICY "hero_banners_select_active"
  ON hero_banners FOR SELECT
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  );

-- INSERT/UPDATE/DELETE 정책 없음 → 어드민은 service role 클라이언트(createAdminClient)로 RLS 우회

-- 시드 없음: 운영자가 어드민에서 실콘텐츠 입력 (여름 콘텐츠 준비 완료).
-- 빈 상태(활성 배너 0건)는 HeroBanner 컴포넌트의 gradient fallback이 graceful 처리.
