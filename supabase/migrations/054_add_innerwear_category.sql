-- 여성언더웨어/잠옷 대카테고리 + 잠옷/홈웨어 중카테고리 추가
--
-- ⚠️ UUID/슬롯 주의: 운영 DB는 레포 마이그레이션 이력보다 앞서 있다(drift).
--   실제 prod 사용 현황(2026-06-29 조회): 대카테고리 a...001~007(상의·하의·아우터·원피스/세트·
--   가방·신발·악세서리), 중카테고리 b...001~042. 따라서 신규 슬롯은 대 a...008 / 중 b...043.
--
-- 분류 결정: 본 카테고리군은 fit_type 비의류로 취급한다.
--   slug 'innerwear'는 category.ts APPAREL_TOP_SLUGS(top/bottom/outer/dress)에 미포함이므로
--   상품 write 시 resolveWriteFitType이 fit_type을 NULL로 강제한다(잠옷/언더웨어는 7종 핏 체계와 무관).
--   → SSOT(category.ts) 변경 불필요. 추후 핏 노출이 필요하면 APPAREL_TOP_SLUGS에 'innerwear' 추가.
--
-- sort_order: 기존 대카테고리(1~7) 뒤에 append(8).
INSERT INTO categories (id, parent_id, name, slug, sort_order) VALUES
  -- 1depth(대카테고리)
  ('a0000000-0000-0000-0000-000000000008', NULL, '여성언더웨어/잠옷', 'innerwear', 8),
  -- 2depth(중카테고리)
  ('b0000000-0000-0000-0000-000000000043', 'a0000000-0000-0000-0000-000000000008', '잠옷/홈웨어', 'innerwear-homewear', 1);
