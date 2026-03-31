-- products에 SEO 친화적 URL용 slug 컬럼 추가
ALTER TABLE products ADD COLUMN slug TEXT;

-- nullable unique index (네이버 임포트 상품은 slug 없이 들어올 수 있음)
CREATE UNIQUE INDEX idx_products_slug ON products(slug) WHERE slug IS NOT NULL;
