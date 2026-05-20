# #48-1 AI 상품 SEO 자동화 — Phase 1 완료 보고서

- **일자**: 2026-05-20
- **브랜치**: `feat/seo-ai-automation`
- **선행 조건 검증**: spec v0.4 + Phase 0 보고서 (2026-05-19) 전제
- **세션 범위**: Phase 1 MVP + Multimodal 구현 + production runtime 검증

---

## Executive Summary

| Track | 결과 | 비고 |
|---|---|---|
| A. 마이그레이션 026 apply + lib 본문 | ✅ | RLS 정책 추가 후 apply. lib 위치 `supabase/functions/_shared/seo/`로 변경 |
| B-1. seo-generate-worker 구현 | ✅ | URL source 방식 (detour 후 단순화) |
| B-2. Production runtime 실측 | ⚠️ → ✅ | @jsquash P0 발동 → Anthropic Vision URL source detour 성공 |
| B-3. cron 1분 schedule | ✅ | pg_cron + vault.secrets + pg_net.http_post. 자동 실행 검증 (1.05s/건) |
| C. 네이버 임포트 hook | ✅ | `src/app/api/naver/import/route.ts` line 232 직후 |
| D. PoC cleanup + PR | ✅ | `supabase/functions/seo-poc/` 삭제. `image-processor-test.ts` 제거 (Anthropic URL source 대체) |

**Live 검증 (통합 검증 2)**: 보류 — `ANTHROPIC_API_KEY` Edge Function secrets 등록 후 1건만 호출 (사용자 액션).

---

## P0 위험 발동 + 해소

### 발동
- **@jsquash WASM이 Supabase Edge production runtime에서 WORKER_RESOURCE_LIMIT (546)**.
- TOP_IMAGES=3 / 1568px → 실패 (5090ms)
- TOP_IMAGES=1 / 800px → 실패 (워밍 후에도)
- 격리 테스트: import 자체는 esm.sh CDN으로 통과 (917ms). 실행 시점에서 CPU/메모리 한계 초과.

### 해소 (detour)
- **Anthropic Vision API `source.type="url"`** 직접 전달 검증 (3건, 30분 timebox).
- 네이버 pstatic 작은(649KB) / 중간(3.1MB) / 큰(3.1MB) 3건 전부 200 OK.
- Image tokens 1533~1543 — Phase 0 manual resize 측정값 1551 대비 ±1% 일치 (Anthropic 서버사이드 resize가 1568px 수준).
- 비용 $0.00664~$0.00667/상품 — Phase 0 추정 $0.009 대비 -26%.
- 결론: 클라이언트 사이드 이미지 처리 완전 불필요. `@jsquash` 의존성 제거.

---

## 통합 검증 결과

### 검증 1 (mock 모드) ✅
- queue 1건 → worker → draft 정상 생성
- 4.4초/건 (cold), 1.05초/건 (warm)
- meta_title 60자 / meta_description 155자 / search_tags 5개 / image_alt_texts 3개

### 검증 2 (live 모드) — 보류
- `ANTHROPIC_API_KEY` Edge Function secrets 등록 후 1건 검증 예정 (~$0.0067)

### 검증 3 (description NULL) ✅
- INACTIVE 상품 1건 (description=NULL, 이미지 1장) 처리
- meta_title / image_alt_texts 정상 생성
- ensureImgAlts(null) → null no-op은 Phase 2 admin 승인 시점 검증 대상 (Phase 1 worker 흐름 외)

### 검증 4 (10건 batch) ✅
- cron 자동 pickup → 10건 처리 5.8초 (spec §4 "15초 내" 대비 2.6× 빠름)
- BATCH_SIZE=10 안정 동작

---

## spec v0.5 정정 권고

| # | 정정 항목 | 사유 |
|---|---|---|
| 1 | §3 lib 위치 `lib/seo/*` → `supabase/functions/_shared/seo/*` | Supabase Edge production 번들러는 `../../../lib/` 접근 불가. Phase 2 Next.js 승인 API에서 사용할 description-parser는 별도 import 경로 필요 (TODO) |
| 2 | §FR-2 B 이미지 처리 방식 | "longest-edge 1568 리사이즈 + base64 인코딩" → "Anthropic Vision `source.type=\"url\"` 직접 전달, 서버사이드 리사이즈". `@jsquash` 의존성 제거 |
| 3 | §4 토큰/비용 정정 | 이미지당 1533~1543 tokens (Anthropic 서버사이드 1568px resize). 3장 multimodal 상품당 $0.00664~$0.00667. $20 cap ≈ 약 3000 상품 |
| 4 | §3 Architecture에서 `image-processor.ts` 제거 | 미사용 |
| 5 | description NULL 분포 정정 | "ACTIVE 41건 중 12건" → 실측 "DELETED/INACTIVE 12건, ACTIVE 0건". Phase 1 worker는 description NULL을 안전 처리하지만 ACTIVE 상품에 description NULL 케이스 자체가 없음 |
| 6 | spec §FR-5 mock 모드 정의 | Claude Code 자율 정의대로 image_alt_texts는 이미지 수만큼 (min(이미지 수, 3))로 산출되도록 구현 — 검증 완료 |

---

## 산출 파일

### 신규 (Phase 1)
```
supabase/
  migrations/
    026_seo_metadata.sql                       # apply 완료 (RLS 2건 포함)
    027_seo_cron.sql                           # pg_cron schedule (vault secret 참조)
  functions/
    seo-generate-worker/
      index.ts                                 # Worker (URL source 방식, v6 deployed)
    _shared/seo/
      ai-client.ts                             # Anthropic SDK + mock 분기
      description-parser.ts                    # Phase 2 admin 승인용 (HTML <img> alt 일괄 삽입)
      main-image-alt.ts                        # 4번째+ 이미지 패턴 alt
      prompts.ts                               # v1.0 system + user + tool schema

src/app/api/naver/import/route.ts              # seo_generation_queue insert hook 삽입

tsconfig.json                                  # supabase/functions/**, scripts/seo-poc/** exclude

scripts/seo-poc/
  anthropic-url-source-test.ts                 # detour 학습 자료 (보존)

docs/seo/
  phase1-report-2026-05-20.md                  # 본 문서
```

### 삭제
```
supabase/functions/seo-poc/                    # Phase 0 PoC (이식 완료)
scripts/seo-poc/image-processor-test.ts        # Anthropic URL source 대체로 미사용
```

### 보존 (학습 자료)
```
scripts/seo-poc/anthropic-token-test.ts        # 토큰 측정 PoC
scripts/seo-poc/description-parser-test.ts     # Phase 2 description-parser 본문 검증 시 참조
docs/seo/phase0-report-2026-05-19.md           # 이력
```

---

## 사용자 액션 (Phase 1 완료를 위해 필요)

### 1. Live 검증을 위한 secrets 등록
Supabase Dashboard → Project → Edge Functions → `seo-generate-worker` → Secrets:
- `ANTHROPIC_API_KEY` = (.env.local의 값)
- `SEO_AI_MODE` = `live` (기본 mock, 검증 후 다시 mock으로 또는 운영 모드 결정)

### 2. 진단용 Edge Function 삭제
`seo-jsquash-test` 함수 (verify_jwt=false, P0 격리 검증용으로 사용) — Dashboard에서 삭제. MCP에 delete tool 없음.

---

## Phase 2 진입 시 우려/주의 사항

1. **vault.secrets `seo_worker_auth` 항목 의존**: 027 migration은 vault entry 존재 가정. 신규 환경 setup 시 vault 등록 수동 (또는 setup script).
2. **stuck `processing` 상태**: Worker가 도중 crash 시 queue row가 `processing` 상태로 stuck (B-2 P0 발동 중 실측). Phase 2에서 "started_at + 5분 경과한 processing → pending 자동 복구" 잡 필요.
3. **description NULL 케이스**: ACTIVE 41건 모두 description 있음. Phase 2 backfill 진행 시에도 description NULL fallback은 dead code일 가능성 — 단 description 삭제 가능성 대비 코드 유지.
4. **Phase 2 Next.js 승인 API**: `supabase/functions/_shared/seo/description-parser.ts`를 어떻게 import할지 결정 필요 (npm:specifier가 Next.js Node에서는 안 됨 → node-html-parser를 package.json deps에 추가하고 별도 wrapper 작성 권장).

---

## Phase 1 완료 판정

**전체 PR 머지 가능 상태**: ✅
- npx tsc --noEmit: 0 errors
- npx next lint: 0 warnings
- Mock 통합 검증 1/3/4 통과
- Production cron 자동 실행 검증 완료
- 027 migration apply 완료
- Sentry tag 추가됨 (`area: 'seo_queue'`)

**Live 검증만 사용자 액션 (ANTHROPIC_API_KEY Edge Function secrets 등록) 후 즉시 가능 — Phase 1 완료 후 처리해도 머지 차단 아님.**
