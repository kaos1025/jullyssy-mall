-- review-images 버킷 allowed_mime_types 에 image/jpg variant 추가
-- 클라이언트 일부가 image/jpg 로 보내는 케이스 대비 (표준은 image/jpeg)
-- 클라 단 검증 (ReviewFormBody) 의 ALLOWED_MIMES 와 동일 셋 유지

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]
WHERE id = 'review-images';
