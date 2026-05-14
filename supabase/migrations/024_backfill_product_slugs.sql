-- supabase/migrations/024_backfill_product_slugs.sql
--
-- #48-2 SLUG-BACKFILL-1
-- products.slug 70건 backfill + UNIQUE + NOT NULL 제약
--
-- 변환 알고리즘: src/lib/slug.ts (toSlug + dedupeSlug)
-- - 한글 보존 (구글/네이버 한글 URL 색인 지원)
-- - 영문 lowercase + 공백→하이픈
-- - 한글 음절(U+AC00~U+D7A3) + 영숫자 + 하이픈만 보존
-- - 중복 충돌 시 -2/-3/-4 suffix (16건 발생, Phase 2 운영자 검토 완료)
-- - 80자 제한 (실측 최대 47자, 트림 0건)
--
-- 롤백: 후속 마이그레이션 025 작성 시
--   ALTER TABLE products ALTER COLUMN slug DROP NOT NULL;
--   ALTER TABLE products DROP CONSTRAINT products_slug_unique;
--   UPDATE products SET slug = NULL;

BEGIN;

-- ============================================================
-- 1) 70건 slug backfill
-- ============================================================

-- 상품등록 테스트
UPDATE products SET slug = '상품등록-테스트' WHERE id = 'a8c71b44-6286-423d-b0ac-4c02cdb2e2b9';
-- 프릴 V넥 블라우스 여성 긴팔 셔츠 스모크 밴딩 하객룩 출근룩 2color
UPDATE products SET slug = '프릴-v넥-블라우스-여성-긴팔-셔츠-스모크-밴딩-하객룩-출근룩-2color' WHERE id = '1b75ef4a-662f-4c21-84df-7ba685f9b9ad';
-- 벚꽃룩 얼굴소멸 브이넥 여리핏 자수레이스 진주버튼 펀칭 블라우스
UPDATE products SET slug = '벚꽃룩-얼굴소멸-브이넥-여리핏-자수레이스-진주버튼-펀칭-블라우스' WHERE id = '143e8f01-eaa6-4ddc-b96c-445b2e353aa5';
-- 자수펀칭 아일렛 블라우스 여성 화이트 레이스 브이넥 셔츠 하객룩
UPDATE products SET slug = '자수펀칭-아일렛-블라우스-여성-화이트-레이스-브이넥-셔츠-하객룩' WHERE id = 'fcbba6de-581e-45b6-bdcd-8083b9069e23';
-- 비율여신 롱다리 하이웨스트 세미부츠컷 와이드 청바지 중청 여성 데님진
UPDATE products SET slug = '비율여신-롱다리-하이웨스트-세미부츠컷-와이드-청바지-중청-여성-데님진' WHERE id = 'a02a004c-6764-4578-9b44-da61dbd37eb0';
-- [레귤러핏] 키작녀 8부 9부 청바지 속밴딩 텐션 스판 데님진 중청 흑청
UPDATE products SET slug = '레귤러핏-키작녀-8부-9부-청바지-속밴딩-텐션-스판-데님진-중청-흑청' WHERE id = '07d1a80e-0c4e-4d53-a595-aed661751330';
-- [보온성짱] 여성 벨벳 융기모 와이드 청바지 겨울 통바지 하이웨스트 데님진
UPDATE products SET slug = '보온성짱-여성-벨벳-융기모-와이드-청바지-겨울-통바지-하이웨스트-데님진' WHERE id = '19bf8fe0-1fe8-456d-ace5-9741c6116289';
-- 여성 벨벳 융기모 와이드 청바지 겨울 통바지 하이웨스트 데님 [S-XL]
UPDATE products SET slug = '여성-벨벳-융기모-와이드-청바지-겨울-통바지-하이웨스트-데님-s-xl' WHERE id = '4911a780-2054-439b-bfe2-b9557c6708cf';
-- 여자 겨울 기모 와이드 청바지 호피 레오파드 사선절개 데님 팬츠
UPDATE products SET slug = '여자-겨울-기모-와이드-청바지-호피-레오파드-사선절개-데님-팬츠' WHERE id = '11261bad-2653-4fe1-b2ff-0ef127d64c15';
-- [4size] 겨울 기모 일자핏 히든밴딩 청바지 여성 테이퍼드 데님 팬츠
UPDATE products SET slug = '4size-겨울-기모-일자핏-히든밴딩-청바지-여성-테이퍼드-데님-팬츠' WHERE id = '3aca38b3-9487-4db4-a2df-499f7ddc659e';
-- [길어보여요] 세미부츠컷 여성청바지 빈티지 워싱 부츠컷 청바지 데님
UPDATE products SET slug = '길어보여요-세미부츠컷-여성청바지-빈티지-워싱-부츠컷-청바지-데님' WHERE id = '70c22c4e-a8af-414d-a16b-7f28f273c91a';
-- [5사이즈/국내생산] 포인트 일자라인 와이드핏 여성 중청 데님진 청바지
UPDATE products SET slug = '5사이즈국내생산-포인트-일자라인-와이드핏-여성-중청-데님진-청바지' WHERE id = '7c81e96d-c1ca-4fd4-b64e-2ae8d0354e92';
-- [프리미엄진] 리본자수 세미부츠컷청바지 중청바지 데님
UPDATE products SET slug = '프리미엄진-리본자수-세미부츠컷청바지-중청바지-데님' WHERE id = '2244c136-40c5-4a07-8a7b-ebfff3dcb5b5';
-- 2color 글로시 봄가을 레더 자켓 세미크롭 블루종 점퍼 집업 데일리 아우터
UPDATE products SET slug = '2color-글로시-봄가을-레더-자켓-세미크롭-블루종-점퍼-집업-데일리-아우터' WHERE id = '97449c7f-440b-449d-9420-5b1f59d8c54a';
-- 여성 가을 차이나카라 레더자켓 라이더 가죽 자켓 아우터
UPDATE products SET slug = '여성-가을-차이나카라-레더자켓-라이더-가죽-자켓-아우터' WHERE id = '83649bd9-655d-45c9-8113-fc4c350258e4';
-- [고퀄리티] 여성 크롭 레더자켓 라이더 가죽 자켓 3color
UPDATE products SET slug = '고퀄리티-여성-크롭-레더자켓-라이더-가죽-자켓-3color' WHERE id = 'c7468777-dcc6-44d4-9712-990d41d91beb';
-- [연프스타일] 오프숄더 어깨트임 블라우스 새틴 실켓 여리여리 긴팔 하객룩
UPDATE products SET slug = '연프스타일-오프숄더-어깨트임-블라우스-새틴-실켓-여리여리-긴팔-하객룩' WHERE id = '137373a9-35a5-459e-a7cf-750e4945b8be';
-- 얼굴소멸 로맨틱 실루엣 니트 배색 레이어드 셔츠 여성 상의 블라우스
UPDATE products SET slug = '얼굴소멸-로맨틱-실루엣-니트-배색-레이어드-셔츠-여성-상의-블라우스' WHERE id = '8da43d18-d498-447d-b922-e88711ae8ba9';
-- [고밀도면 국내생산] 빈티지 프린팅 여성 반팔 티셔츠 여유핏 라운드넥 화이트 그레이티
UPDATE products SET slug = '고밀도면-국내생산-빈티지-프린팅-여성-반팔-티셔츠-여유핏-라운드넥-화이트-그레이티' WHERE id = 'd1bce576-5369-4362-88ff-9ee27fb2a44b';
-- 5color 보들보들 테리무드 프린팅 빈티지 여성 반팔 티셔츠 포인트룩
UPDATE products SET slug = '5color-보들보들-테리무드-프린팅-빈티지-여성-반팔-티셔츠-포인트룩' WHERE id = '051727f4-7ce2-4464-adda-a5127238e416';
-- 여성 면 반팔티 국내제작 레터링 티셔츠 여유핏 빅사이즈 이너 티셔츠
UPDATE products SET slug = '여성-면-반팔티-국내제작-레터링-티셔츠-여유핏-빅사이즈-이너-티셔츠' WHERE id = 'f857668e-466e-4a9b-8e84-de6f3fb49491';
-- [길어보여요] 옆절개라인 여성 세미와이드청바지 연청바지 데님
UPDATE products SET slug = '길어보여요-옆절개라인-여성-세미와이드청바지-연청바지-데님' WHERE id = '3321b4dd-7aa9-431d-9e5b-eddb2959a617';
-- [길어보여요] 세미부츠컷 여성청바지 빈티지 워싱 부츠컷 청바지 데님
UPDATE products SET slug = '길어보여요-세미부츠컷-여성청바지-빈티지-워싱-부츠컷-청바지-데님-2' WHERE id = 'ba0079c5-b84a-4216-bfae-1e5901b83dbf';
-- [길어보여요] 국내생산 10수 고밀도 여성 빈티지 와이드팬츠 봄가을 면바지
UPDATE products SET slug = '길어보여요-국내생산-10수-고밀도-여성-빈티지-와이드팬츠-봄가을-면바지' WHERE id = '2683bace-4033-464b-a0fd-f975374ad195';
-- [길어보여요] 옆절개라인 여성 세미와이드청바지 연청바지 데님
UPDATE products SET slug = '길어보여요-옆절개라인-여성-세미와이드청바지-연청바지-데님-2' WHERE id = 'b7033be9-4a1a-4076-a768-e6eaa3b244ed';
-- [고밀도면 국내생산] 빈티지 프린팅 여성 반팔 티셔츠 여유핏 라운드넥 화이트 그레이티
UPDATE products SET slug = '고밀도면-국내생산-빈티지-프린팅-여성-반팔-티셔츠-여유핏-라운드넥-화이트-그레이티-2' WHERE id = '48af6596-68d6-43fa-903c-b8d0411b5b44';
-- 5color 보들보들 테리무드 프린팅 빈티지 여성 반팔 티셔츠 포인트룩
UPDATE products SET slug = '5color-보들보들-테리무드-프린팅-빈티지-여성-반팔-티셔츠-포인트룩-2' WHERE id = '3edc3c48-cf6f-4abe-ac17-da965628e2e1';
-- [고밀도면 국내생산] 빈티지 프린팅 여성 반팔 티셔츠 여유핏 라운드넥 화이트 그레이티
UPDATE products SET slug = '고밀도면-국내생산-빈티지-프린팅-여성-반팔-티셔츠-여유핏-라운드넥-화이트-그레이티-3' WHERE id = '8fde825a-0853-4f67-b797-263ecd6e8980';
-- 5color 보들보들 테리무드 프린팅 빈티지 여성 반팔 티셔츠 포인트룩
UPDATE products SET slug = '5color-보들보들-테리무드-프린팅-빈티지-여성-반팔-티셔츠-포인트룩-3' WHERE id = 'ec0401cc-4a64-4057-91a8-0b0b57aa6574';
-- [고밀도면 국내생산] 빈티지 프린팅 여성 반팔 티셔츠 여유핏 라운드넥 화이트 그레이티
UPDATE products SET slug = '고밀도면-국내생산-빈티지-프린팅-여성-반팔-티셔츠-여유핏-라운드넥-화이트-그레이티-4' WHERE id = '43b68c42-7051-4d48-ac65-a93d671d9e25';
-- 5color 보들보들 테리무드 프린팅 빈티지 여성 반팔 티셔츠 포인트룩
UPDATE products SET slug = '5color-보들보들-테리무드-프린팅-빈티지-여성-반팔-티셔츠-포인트룩-4' WHERE id = 'fd646213-46c5-40df-be84-d78bc4183008';
-- 블루종 점퍼 봄가을 카라 스웨이드자켓 카멜 블랙 집업 아우터
UPDATE products SET slug = '블루종-점퍼-봄가을-카라-스웨이드자켓-카멜-블랙-집업-아우터' WHERE id = 'e6c539c7-3631-4e31-a239-176f2f9b60da';
-- [3WAY 디자인] 스웨이드 호보백 미니 숄더백 토트백 크로스백 3color
UPDATE products SET slug = '3way-디자인-스웨이드-호보백-미니-숄더백-토트백-크로스백-3color' WHERE id = '0143787f-18d2-43b3-8409-64c65889f5ec';
-- [고퀄 국내생산] 2color 클래식 페미닌 슬림핏 벨티드 여성자켓 허리라인 하객룩
UPDATE products SET slug = '고퀄-국내생산-2color-클래식-페미닌-슬림핏-벨티드-여성자켓-허리라인-하객룩' WHERE id = 'a304d93a-684a-4f24-8c90-4e7c591ed707';
-- [국내생산] 허리셔링 드레이프 여성 반팔 티셔츠 단추포인트 라운드넥 3color
UPDATE products SET slug = '국내생산-허리셔링-드레이프-여성-반팔-티셔츠-단추포인트-라운드넥-3color' WHERE id = 'fd919c31-5de2-42f0-98a8-3399358f1b70';
-- 2color 여리광택 새틴 레이어드 롱 스커트 쉬폰 이중 슬릿 밴딩 롱치마
UPDATE products SET slug = '2color-여리광택-새틴-레이어드-롱-스커트-쉬폰-이중-슬릿-밴딩-롱치마' WHERE id = 'c89465a1-1e63-4ffb-bc6d-0e89e19c8050';
-- 국내생산 뽀송 도톰 니트 울가디건 여성 봄가을 아우터 3color
UPDATE products SET slug = '국내생산-뽀송-도톰-니트-울가디건-여성-봄가을-아우터-3color' WHERE id = '934ee141-a478-432e-9fb6-0e0a2b96be15';
-- 인생보정핏 여성 세미 와이드 슬랙스 하이웨이스트 핀턱 정장 바지 팬츠 3color
UPDATE products SET slug = '인생보정핏-여성-세미-와이드-슬랙스-하이웨이스트-핀턱-정장-바지-팬츠-3color' WHERE id = 'eeeb917b-c6e6-42b9-87e0-37a5c49280d2';
-- 2color 글로시 봄가을 레더 자켓 세미크롭 블루종 점퍼 집업 데일리 아우터
UPDATE products SET slug = '2color-글로시-봄가을-레더-자켓-세미크롭-블루종-점퍼-집업-데일리-아우터-2' WHERE id = '102486a6-94e5-4c28-a2b4-cb09a2d6582c';
-- 다리 길어보이는 하이텐션 스판 슬림 카프리 여성 팬츠 8부 바지슬랙스
UPDATE products SET slug = '다리-길어보이는-하이텐션-스판-슬림-카프리-여성-팬츠-8부-바지슬랙스' WHERE id = 'dc607bdf-e6da-43e6-a8d8-f050345760c0';
-- 2color 색감깡패 워싱원단 봄가을 여성 면자켓 숏점퍼 간절기 아우터
UPDATE products SET slug = '2color-색감깡패-워싱원단-봄가을-여성-면자켓-숏점퍼-간절기-아우터' WHERE id = '2d109908-febb-4162-aae9-28db118be4e0';
-- 텐션짱 슬림핏 헨리넥 골지 단추 니트 긴팔 티셔츠 배색 포인트 3color
UPDATE products SET slug = '텐션짱-슬림핏-헨리넥-골지-단추-니트-긴팔-티셔츠-배색-포인트-3color' WHERE id = '1c77f980-4bd2-448e-af51-d4dea88eefa9';
-- 3way 페이즐리 패턴 삼각 실키 스카프 배색 바이어스 멀티웨이 코디템
UPDATE products SET slug = '3way-페이즐리-패턴-삼각-실키-스카프-배색-바이어스-멀티웨이-코디템' WHERE id = '42211b9c-4404-4cf0-83d6-f3874edccfc5';
-- 2color 레이어드 힙커버 자수 미니스커트 랩스커트 화이트 베이지
UPDATE products SET slug = '2color-레이어드-힙커버-자수-미니스커트-랩스커트-화이트-베이지' WHERE id = '156851aa-c7b6-4642-af50-4253e1fffce3';
-- 봄가을 아우터 카라 기본 모던핏 청자켓 중청 데님점퍼
UPDATE products SET slug = '봄가을-아우터-카라-기본-모던핏-청자켓-중청-데님점퍼' WHERE id = 'b56daf7f-48d8-4176-8f8b-24ff0dddcc96';
-- 여성 카라 트위드자켓 세미크롭 하객룩 봄 가을 아우터 재킷 3color
UPDATE products SET slug = '여성-카라-트위드자켓-세미크롭-하객룩-봄-가을-아우터-재킷-3color' WHERE id = '9194cccd-11d2-4348-a78e-329798d87f54';
-- [국내제작] 여성 세미크롭 셔츠 슬림핏 잔스트라이프 남방 투포켓 오피스룩
UPDATE products SET slug = '국내제작-여성-세미크롭-셔츠-슬림핏-잔스트라이프-남방-투포켓-오피스룩' WHERE id = '94bb461c-e955-486c-bd4e-c50189c2fbe0';
-- 푹신한 스트라이프 거실화 강아지 자수 실내용 슬리퍼 커플템 남녀공용
UPDATE products SET slug = '푹신한-스트라이프-거실화-강아지-자수-실내용-슬리퍼-커플템-남녀공용' WHERE id = '3f43514d-2ace-47ae-8b5a-a594d3f3b394';
-- 프릴 V넥 블라우스 여성 긴팔 셔츠 스모크 밴딩 하객룩 출근룩 2color
UPDATE products SET slug = '프릴-v넥-블라우스-여성-긴팔-셔츠-스모크-밴딩-하객룩-출근룩-2color-2' WHERE id = '347ea5f8-41a7-4b97-b291-0ff835931f7a';
-- 폭닥 레터링 여성 니트 루즈핏 라운드넥 긴팔 스웨터 3color
UPDATE products SET slug = '폭닥-레터링-여성-니트-루즈핏-라운드넥-긴팔-스웨터-3color' WHERE id = 'e1650df6-2302-420f-9fe2-0a732ae6958d';
-- 여성 면 반팔티 국내제작 레터링 티셔츠 여유핏 빅사이즈 이너 티셔츠
UPDATE products SET slug = '여성-면-반팔티-국내제작-레터링-티셔츠-여유핏-빅사이즈-이너-티셔츠-2' WHERE id = 'c6c6ba44-7027-4819-91aa-03d67d39e5d5';
-- 2color 레이어드 밑단 레이스 포인트 A라인 스커트 플리츠 치마
UPDATE products SET slug = '2color-레이어드-밑단-레이스-포인트-a라인-스커트-플리츠-치마' WHERE id = 'b136c450-b139-4648-8984-e3e09a147a45';
-- 진주꽃자수 비즈 스팽글 크롭 뷔스티에 조끼 레이스 레이어드룩
UPDATE products SET slug = '진주꽃자수-비즈-스팽글-크롭-뷔스티에-조끼-레이스-레이어드룩' WHERE id = '582c051a-888c-448a-9c95-71d4f840d958';
-- 벚꽃룩 얼굴소멸 브이넥 여리핏 자수레이스 진주버튼 펀칭 블라우스
UPDATE products SET slug = '벚꽃룩-얼굴소멸-브이넥-여리핏-자수레이스-진주버튼-펀칭-블라우스-2' WHERE id = '21156736-4978-43b6-9084-bbb477eab59b';
-- 3040 출근룩 빅사이즈 여성 사파리 점퍼 봄 가을 간절기 아우터
UPDATE products SET slug = '3040-출근룩-빅사이즈-여성-사파리-점퍼-봄-가을-간절기-아우터' WHERE id = '4dc99ea6-f8b2-4e35-8fa4-c33d7a0576b1';
-- 비율여신 롱다리 하이웨스트 세미부츠컷 와이드 청바지 중청 여성 데님진
UPDATE products SET slug = '비율여신-롱다리-하이웨스트-세미부츠컷-와이드-청바지-중청-여성-데님진-2' WHERE id = '31739f3e-26bc-4561-9309-73a35e24cf32';
-- 자수펀칭 아일렛 블라우스 여성 화이트 레이스 브이넥 셔츠 하객룩
UPDATE products SET slug = '자수펀칭-아일렛-블라우스-여성-화이트-레이스-브이넥-셔츠-하객룩-2' WHERE id = '457aa536-ab9c-421d-b719-6b250b4d2555';
-- [연프스타일] 오프숄더 어깨트임 블라우스 새틴 실켓 여리여리 긴팔 하객룩
UPDATE products SET slug = '연프스타일-오프숄더-어깨트임-블라우스-새틴-실켓-여리여리-긴팔-하객룩-2' WHERE id = 'e6d7a21a-5050-4117-a768-73df6ea01902';
-- [레귤러핏] 키작녀 8부 9부 청바지 속밴딩 텐션 스판 데님진 중청 흑청
UPDATE products SET slug = '레귤러핏-키작녀-8부-9부-청바지-속밴딩-텐션-스판-데님진-중청-흑청-2' WHERE id = '9970718b-32aa-4100-966a-95df91e2267c';
-- 윤기 글로우 페이크퍼 사각 케이프 판초숄 털자켓 레이어드 망토 머플러 4color
UPDATE products SET slug = '윤기-글로우-페이크퍼-사각-케이프-판초숄-털자켓-레이어드-망토-머플러-4color' WHERE id = 'ae60a0ca-32a4-42f5-8806-fbf8236bebae';
-- [램스울 50%] 홀가먼트 사각 케이프 버튼 판초 숄가디건 레이어드 니트 망토 3color
UPDATE products SET slug = '램스울-50-홀가먼트-사각-케이프-버튼-판초-숄가디건-레이어드-니트-망토-3color' WHERE id = '3f6eae63-71bc-4456-8dee-c85c5fd6e5c6';
-- 타이끈 레이어드 니트 셔츠 배색 블라우스 퍼프소매 뷔스티에 2color
UPDATE products SET slug = '타이끈-레이어드-니트-셔츠-배색-블라우스-퍼프소매-뷔스티에-2color' WHERE id = '77427e51-8733-4cbd-af0e-11673b46bd94';
-- 입체 꽃자수 주얼버튼 포인트 레이어드 모헤어 여성 니트 가디건 그레이
UPDATE products SET slug = '입체-꽃자수-주얼버튼-포인트-레이어드-모헤어-여성-니트-가디건-그레이' WHERE id = '43ce5a65-3a4d-4f06-905c-92cdf467b66d';
-- 보석버튼 배색 라인 부클 가디건 카라자켓 하객패션
UPDATE products SET slug = '보석버튼-배색-라인-부클-가디건-카라자켓-하객패션' WHERE id = 'dc29f8a3-2678-46ca-a971-833833d3ea41';
-- 프릴 티어드 롱스커트 캉캉 플레어치마 화이트 블랙
UPDATE products SET slug = '프릴-티어드-롱스커트-캉캉-플레어치마-화이트-블랙' WHERE id = '8b912882-51f6-4c9b-96ba-6566e354dcbd';
-- 벨트세트 여자 봄 H라인 미디 스커트 하이웨스트 앞트임 정장치마 오피스룩 하객룩
UPDATE products SET slug = '벨트세트-여자-봄-h라인-미디-스커트-하이웨스트-앞트임-정장치마-오피스룩-하객룩' WHERE id = 'd6be0296-3872-4d22-bc31-2e0f1570db2b';
-- 국내생산 라운드넥 금장단추 부클자켓 하객룩 오피스룩 블랙 아이보리
UPDATE products SET slug = '국내생산-라운드넥-금장단추-부클자켓-하객룩-오피스룩-블랙-아이보리' WHERE id = 'e0ec527b-3d86-4b3b-b1b2-4114463612c1';
-- [속바지 O / 국내생산] 군살커버 핀턱 주름 A라인 미니 스커트 블랙치마
UPDATE products SET slug = '속바지-o-국내생산-군살커버-핀턱-주름-a라인-미니-스커트-블랙치마' WHERE id = '2e8f0f42-869d-4a58-be0c-aa2635b4be36';
-- 남녀공용 한파대비 기모 융털 쫀쫀 슬림핏 융기모 롱 레그워머 국내생산
UPDATE products SET slug = '남녀공용-한파대비-기모-융털-쫀쫀-슬림핏-융기모-롱-레그워머-국내생산' WHERE id = '92c42f9f-64fc-425f-b509-a3e995849c34';
-- 얼굴소멸 로맨틱 실루엣 니트 배색 레이어드 셔츠 여성 상의 블라우스 테스트
UPDATE products SET slug = '얼굴소멸-로맨틱-실루엣-니트-배색-레이어드-셔츠-여성-상의-블라우스-테스트' WHERE id = '3af4279a-2930-4562-9c9b-a5d8cc0a81ed';

-- ============================================================
-- 2) NULL 잔여 검증 (실패 시 트랜잭션 자동 ROLLBACK)
-- ============================================================

DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM products WHERE slug IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % 건 NULL slug 잔여', null_count;
  END IF;
END $$;

-- ============================================================
-- 3) UNIQUE 제약 추가 (중복 발생 시 트랜잭션 자동 ROLLBACK)
-- ============================================================

ALTER TABLE products
  ADD CONSTRAINT products_slug_unique UNIQUE (slug);

-- ============================================================
-- 4) NOT NULL 제약 추가
-- ============================================================

ALTER TABLE products
  ALTER COLUMN slug SET NOT NULL;

COMMIT;
