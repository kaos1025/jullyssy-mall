-- review-images 버킷 service_role INSERT/UPDATE/DELETE 정책 추가
-- 017 마이그레이션이 anon 차단 + public read 만 두고 service_role INSERT 허용 정책을
-- 빠뜨려, route.ts (admin client = service_role) 의 upload 시도가 RLS 로 차단됨.
-- → storage.objects 에 review-images 파일 0건. review_images row 0건.
-- 본 마이그레이션으로 service_role 의 INSERT/UPDATE/DELETE 명시 허용.

DROP POLICY IF EXISTS "Service role insert review images" ON storage.objects;
CREATE POLICY "Service role insert review images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'review-images');

DROP POLICY IF EXISTS "Service role update review images" ON storage.objects;
CREATE POLICY "Service role update review images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'review-images')
WITH CHECK (bucket_id = 'review-images');

DROP POLICY IF EXISTS "Service role delete review images" ON storage.objects;
CREATE POLICY "Service role delete review images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'review-images');
