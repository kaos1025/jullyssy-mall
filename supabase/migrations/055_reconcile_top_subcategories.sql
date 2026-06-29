-- 상의(top) 중카테고리 정합 — 레포 이력 ↔ 운영 DB 차이 backfill
--
-- 배경: 운영 DB는 레포 마이그레이션보다 앞서 있다(categories drift, 054 주석 참조).
--   상의(top, a..001) 하위는 레포 001엔 4종(티셔츠/니트/셔츠/블라우스, b..001~004)만 있으나
--   prod엔 '나시/민소매'(b..037)가 추가돼 있다(미커밋 직접 추가분). from-scratch 재생 시
--   prod와 일치하도록 누락분을 backfill한다.
--
-- ⚠️ 멱등: prod엔 이미 존재하므로 ON CONFLICT DO NOTHING으로 no-op 보장(prod 적용 불필요,
--   본 파일은 이력 정합용). 신규 DB 재생 시에만 실제 INSERT.
-- ⚠️ slug 'top-Sleeveless'는 prod 실제값을 그대로 반영(대문자 S — 컨벤션 top-* 소문자와 불일치).
--   소문자 정규화는 URL/상품연결 영향이 있는 별개 변경이라 본 정합 마이그에 포함하지 않는다.
INSERT INTO categories (id, parent_id, name, slug, sort_order) VALUES
  ('b0000000-0000-0000-0000-000000000037', 'a0000000-0000-0000-0000-000000000001', '나시/민소매', 'top-Sleeveless', 5)
ON CONFLICT (id) DO NOTHING;
