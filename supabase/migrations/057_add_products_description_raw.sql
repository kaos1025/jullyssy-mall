-- 057_add_products_description_raw.sql
-- 상세설명 원본(네이버 SmartEditor ONE HTML) 보존 컬럼 추가.
--
-- 배경: 네이버 임포트 시 op.detailContent(se-* HTML)를 products.description에 저장하는데,
--       이후 SEO 승인 라우트가 description에 img alt를 주입(ensureImgAlts)하며 변형한다.
--       향후 정규화(Option B) 가능성과 diff 기준선을 위해 네이버 원본을 별도 보존한다.
--       원본은 비파괴 baseline일 뿐, 렌더/SEO 경로는 기존대로 description을 사용한다.
--
-- 멱등: ADD COLUMN IF NOT EXISTS + 백필은 IS NULL 가드. 재실행 안전.

ALTER TABLE products ADD COLUMN IF NOT EXISTS description_raw text;

COMMENT ON COLUMN products.description_raw IS
  '네이버 임포트 원본 상세설명 HTML(SmartEditor se-*). description 변형 전 baseline. 렌더/SEO 미사용.';

-- 기존 행 백필: 현재 description을 baseline으로 복사.
-- 주의: 이미 SEO img-alt 주입을 거친 행은 완전 pristine은 아니나(구조 보존, 텍스트/이미지 동일),
--       diff 기준선으로 충분. 진짜 원본은 네이버 재조회가 필요하나 범위 외.
UPDATE products
SET description_raw = description
WHERE description_raw IS NULL
  AND description IS NOT NULL;
