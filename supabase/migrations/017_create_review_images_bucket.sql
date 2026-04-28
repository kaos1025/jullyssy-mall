-- review-images Storage 버킷 + 정책 신설
-- 기존 route.ts 가 존재하지 않는 review-images 버킷에 upload 시도 → silent fail
-- → review_images row 0건. 버킷 신설로 정상 동작 회복.
-- public bucket: PDP 비로그인 사용자 표시용. 5MB / image/jpeg|png|webp 제한.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (PDP 비로그인 사용자 표시용)
DROP POLICY IF EXISTS "Public read review images" ON storage.objects;
CREATE POLICY "Public read review images"
ON storage.objects FOR SELECT
USING (bucket_id = 'review-images');

-- anon 직접 업로드 차단 (route.ts 는 service role 사용)
DROP POLICY IF EXISTS "Block direct anon upload to review-images" ON storage.objects;
CREATE POLICY "Block direct anon upload to review-images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id <> 'review-images');
