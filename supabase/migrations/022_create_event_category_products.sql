-- =============================================
-- event_category_products: 이벤트 카테고리 ↔ 상품 매칭
-- =============================================
-- 이벤트 카테고리(예: 벚꽃놀이코디)에 노출할 상품을 운영자가 직접 매칭.
-- 어드민이 service role로 CRUD, anon은 활성+기간 내 이벤트 + ACTIVE 상품만 SELECT.

CREATE TABLE event_category_products (
  event_category_id UUID NOT NULL REFERENCES event_categories(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_category_id, product_id)
);

-- 이벤트 페이지 상품 정렬용 (운영자 지정 순서 → 최신순)
CREATE INDEX idx_event_category_products_order
  ON event_category_products (event_category_id, display_order, created_at DESC);

-- =============================================
-- RLS
-- =============================================
ALTER TABLE event_category_products ENABLE ROW LEVEL SECURITY;

-- 누구나(anon 포함) 활성+기간 내 이벤트의 매칭 + ACTIVE 상품만 SELECT
CREATE POLICY "event_category_products_select_active"
  ON event_category_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM event_categories ec
      WHERE ec.id = event_category_products.event_category_id
        AND ec.is_active = TRUE
        AND (ec.starts_at IS NULL OR ec.starts_at <= NOW())
        AND (ec.ends_at IS NULL OR ec.ends_at >= NOW())
    )
    AND EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = event_category_products.product_id
        AND p.status = 'ACTIVE'
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 → 어드민은 service role 클라이언트로 RLS 우회

-- =============================================
-- event_categories.link_url NULLABLE 전환
-- =============================================
-- 매칭 1건 이상이면 /events/{id}로 라우팅, 없으면 link_url 사용 (또는 클릭 무효).
-- 기존 데이터(/products?search=봄코디)는 시드에서 NULL로 갱신.
ALTER TABLE event_categories ALTER COLUMN link_url DROP NOT NULL;
