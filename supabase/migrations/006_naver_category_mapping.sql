-- 네이버 카테고리 → 쥴리씨 카테고리 매핑 테이블
CREATE TABLE naver_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naver_category_id TEXT NOT NULL UNIQUE,
  naver_category_name TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_naver_category_mappings_naver_id ON naver_category_mappings(naver_category_id);
