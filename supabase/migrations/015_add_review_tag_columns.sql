-- 리뷰 4축 태그 컬럼 추가 (사이즈/컬러/두께/신축성)
-- 모두 nullable: 기존 리뷰 데이터 보호
-- CHECK 제약: 허용된 값만 저장

alter table public.reviews
  add column tag_size text check (tag_size in ('약간 작아요', '딱 맞아요', '약간 커요')),
  add column tag_color text check (tag_color in ('화면보다 어두워요', '화면과 똑같아요', '화면보다 밝아요')),
  add column tag_thickness text check (tag_thickness in ('얇아요', '적당해요', '두꺼워요')),
  add column tag_stretch text check (tag_stretch in ('없어요', '적당해요', '많이 있어요'));

-- 집계 RPC에서 product_id 필터 + 태그 컬럼 IS NOT NULL 스캔이 잦으므로 부분 인덱스
create index if not exists idx_reviews_product_tags
  on public.reviews (product_id)
  where tag_size is not null
     or tag_color is not null
     or tag_thickness is not null
     or tag_stretch is not null;
