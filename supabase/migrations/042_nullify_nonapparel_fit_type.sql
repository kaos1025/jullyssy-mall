-- v0.8 Track G (FIT-NONAPPAREL-GUARD-1) — 비의류 fit_type NULL 허용 + 기존 정리.
-- 040은 fit_type을 NOT NULL DEFAULT 'REGULAR'로 추가 → 비의류 NULL 저장 불가였음.
-- 운영자 확정: 비의류(가방/신발/악세서리)는 fit_type 무의미 → NULL.
--
-- 1) NOT NULL 해제 (CHECK는 NULL 통과, DEFAULT 'REGULAR'는 유지 — 누락 insert만 영향).
-- 2) 기존 비의류 fit_type → NULL 정리 (refit-batch가 의류 한정이라 비의류는 default REGULAR 잔존).

ALTER TABLE products
  ALTER COLUMN fit_type DROP NOT NULL;

-- 비의류 카테고리(자신 또는 부모 TOP slug ∈ bag/shoes/accessory) → fit_type NULL
UPDATE products p
SET fit_type = NULL
FROM categories c
LEFT JOIN categories pc ON pc.id = c.parent_id
WHERE p.category_id = c.id
  AND p.fit_type IS NOT NULL
  AND COALESCE(pc.slug, c.slug) IN ('bag', 'shoes', 'accessory');

COMMENT ON COLUMN products.fit_type IS 'v0.8: 운영자 메타 layer fit_type. 의류만 의미(비의류 NULL). Layer 1(네이버 API)/2(description)/3(default REGULAR).';
