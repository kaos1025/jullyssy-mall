-- v0.8 Track 1-A A-1: 상품 fit_type 운영자 메타 layer
-- SSOT: src/lib/product/fit-type.ts (FIT_TYPE_VALUES / FIT_TYPE_LABELS)
-- 기존 86건 row는 DEFAULT 'REGULAR' 자동 적용 (PG11+ constant default → metadata-only).

ALTER TABLE products
  ADD COLUMN fit_type TEXT NOT NULL DEFAULT 'REGULAR'
  CHECK (fit_type IN ('REGULAR', 'SLIM', 'OVERSIZED', 'WIDE', 'STRAIGHT', 'LOOSE', 'CROPPED'));

CREATE INDEX idx_products_fit_type ON products(fit_type);

COMMENT ON COLUMN products.fit_type IS 'v0.8: 운영자 메타 layer fit_type. Layer 1 (네이버 API) / Layer 2 (description-parser 휴리스틱) / Layer 3 (default REGULAR)';
