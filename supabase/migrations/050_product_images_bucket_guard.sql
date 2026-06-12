-- product-images 버킷 레벨 2차 방어 (코드단 validateImageFile 우회 경로 대비 defense-in-depth)
-- 실측(Day 51): product-images = file_size_limit NULL, allowed_mime_types NULL → 버킷 가드 전무
-- 코드단 업로드 경로 전수(3개: hero-banners.ts / admin/products[POST] / admin/products/[id][PUT])는
--   전부 validateImageFile(8MB + jpeg/jpg/png/webp) 선검증 → 본 설정은 strict superset, 기존 업로드 회귀 0
-- allowed_mime_types/file_size_limit 는 신규 업로드만 검증 (기존 객체 미영향)
-- 마이그 017/018/019(review-images) 와 동일하게 버킷 가드는 마이그레이션으로 관리

UPDATE storage.buckets
SET file_size_limit = 8388608, -- 8MB = 8 * 1024 * 1024, image-upload-validation.ts MAX 와 정합
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ]
WHERE id = 'product-images';
