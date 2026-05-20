# #48-1 AI 상품 SEO 자동화 — Phase 2 완료 보고서

- **일자**: 2026-05-20 (Day 28)
- **브랜치**: `feat/seo-admin-ui`
- **선행 조건**: spec v0.5 + Phase 1 완료 (PR #23 → main `a756379`)
- **세션 범위**: 어드민 검토 UI + 승인/거절/재생성 API + Vercel Node ensureImgAlts 적용

---

## Executive Summary

| Track | 결과 | 비고 |
|---|---|---|
| A. `/admin/seo-drafts` page + GET API | ✅ | Server Component + Client 분리, 검토 패널 + 인라인 편집 + 액션 4종 |
| B. PATCH/approve/reject/regenerate-seo | ✅ | 마이그레이션 028 `approve_seo_draft` RPC 채택 (트랜잭션 보장) |
| C. ensureImgAlts Vercel Node | ✅ | `node-html-parser@7.0.1` npm import, 시그니처 단일화 (`ensureImgAlts(html, injections, options)`) |
| 통합 검증 1~4 | ✅ | mock draft `ec62a131` 편집·승인, `7362bbbe`·`24eaa609` 거절, `381c0248` 재생성 |
| 통합 검증 5 | 시대체 ✅ | 단위 테스트 13/13 PASS + RPC SQL 안전성 명시 (ACTIVE 풀 description NULL 0건) |

**전체 PR 머지 가능 상태**: ✅ (tsc 0 / next lint 0 / next build 0 / 단위 13/13 PASS)

---

## description-parser import 경로 결정

명세 Track C-1 가정과 main 실측 불일치 발견 ([[memory-label-verify]] 발동):

| 항목 | spec v0.5 가정 | main 실측 (Phase 1 PR #23) |
|---|---|---|
| 위치 | `lib/seo/description-parser.ts` | `supabase/functions/_shared/seo/description-parser.ts`만 존재 |
| import | `from 'node-html-parser'` (npm) | `from "https://esm.sh/node-html-parser@7.0.1"` (Deno) |
| dependencies | 등록됨 | **미등록** |
| 시그니처 | `ensureImgAlts(html)` | `ensureImgAlts(html, injections, options)` |

**처리 (자율 결정 + 사용자 가이드 4건 반영)**:

1. `node-html-parser@7.0.1` npm dependencies 신규 추가 (`--save-exact`, Edge worker esm.sh와 동일 버전 고정)
2. `src/lib/seo/description-parser.ts` 신규 산출 (Vercel Node 전용)
3. 시그니처 단일화: Phase 1 확장 시그니처 `ensureImgAlts(html, injections, options)` 그대로 이식. Phase 2 승인 라우트는 `injections=[]` 빈 배열 호출로 v0.4 의미(빈 alt 일괄 삽입) 그대로 작동
4. Edge worker `supabase/functions/_shared/seo/description-parser.ts`에도 빈 alt 자동 삽입 로직 + 동기화 docstring 추가 ([[dual-runtime-signature]] feedback)

**Edge worker redeploy 불필요**: Phase 1 worker는 description-parser를 import만 하고 호출 안 함 (URL detour). 빈 alt 자동 삽입 로직 추가는 dead code 갱신.

---

## 통합 검증 결과

### 검증 1 — 인라인 편집 → 저장 ✅
- Draft `ec62a131` (얼굴소멸 로맨틱 셔츠 테스트)
- meta_title 끝에 ` | 데일리` 추가 → PATCH 200
- DB: `meta_title` 갱신 (len 42), status='pending_review' 유지, `updated_at` > `created_at`

### 검증 2 — 첫 승인 흐름 ✅
- 같은 draft `ec62a131` "승인 및 적용" → approve 200 in 6.1s
- Draft: status='approved', `reviewed_by`=admin uuid, `reviewed_at`, `review_note`=null
- products: `meta_title` len 42, `meta_description` len 71, `search_tags` 5개, `seo_updated_at` 갱신
- `products.description`: 204286 → **197282자** (-7K, -3.4%)
  - node-html-parser 재직렬화: 빈 alt 일괄 삽입 + attribute 순서 변경 + 공백 정규화
  - 운영자 검토 요청 항목 (콘텐츠 동일성 정밀 비교는 Phase 3 backfill 전 1건 샘플로 별도 진행)
- `product_images` 9장 전부 alt_text 갱신:
  - idx 0/1/2 (sort_order asc): AI alt 적용 (29자, mock draft 동일 패턴)
  - idx 3~8: 패턴 alt "상세컷 1~6" 정확 적용
- revalidatePath: dev log 정상 응답 (Vercel CDN 무효화는 production 환경에서 확증)

### 검증 3 — 거절 ✅
- Draft `7362bbbe` (레더 자켓) "거절" → reject 200
- Draft: status='rejected', `reviewed_by` + `reviewed_at` 적용, `review_note`=null
- products `102486a6`: `meta_title`=null, `seo_updated_at`=null, `images_with_alt`=0 (변경 0 확증)

추가: `24eaa609` (와이드 슬랙스)도 별도 거절 — 의도된 클릭, 검증 의미 동일.

### 검증 4 — 재생성 ✅
- Draft `381c0248` (울가디건) 미리보기에서 "재생성" → POST 200
- Queue insert: `514bbe09`, trigger_source='manual_regenerate', scheduled_at 07:47:42
- Worker pickup: started_at 07:48:00 (cron 1분 schedule 다음 분 0초)
- 처리: 8초 (07:48:00 → 07:48:08)
- 신규 draft: `36fa0c04`, status='pending_review', model=`claude-haiku-4-5-20251001`, **cost_usd $0.009324** (live)

### 검증 5 — description NULL 승인 (시대체) ✅
- ACTIVE 풀에서 description NULL **0건** (Phase 1 §우려 #3 동일 — "dead code 가능성")
- DELETED 29건 중 12건 NULL — 운영 데이터 임시 변경 회피 결정
- 단위 테스트 `scripts/seo-poc/description-parser-node-test.ts` **13/13 PASS**:
  1. `ensureImgAlts(null)` === null ✅
  2. `ensureImgAlts(undefined)` === null ✅
  3. `ensureImgAlts("")` === "" ✅
  4. 빈 alt 일괄 삽입 (img 2개) ✅
  5. 기존 `alt="kept"` 보존 ✅
  6. AI alt 주입 (injections) ✅
  7. `overwriteExisting=true` 시 덮어쓰기 ✅
  8. `injectAltTexts` 통계 (injected/preserved/totalImages) ✅
  9. img 없는 HTML 통과 ✅
- RPC SQL 안전성: `UPDATE products SET description = p_processed_description` — NULL 값을 그대로 UPDATE → description NULL 유지. 코드 path 검증 완료.

---

## ensureImgAlts(null) 단위 테스트 결과

- 실행: `npx tsx scripts/seo-poc/description-parser-node-test.ts`
- 결과: **All 13 tests passed**
- vitest 미도입 (codebase 단독 테스트 인프라 도입 회피, 명세 자율 영역)
- 부수 발견: node-html-parser는 빈 attribute를 HTML5 boolean 스타일 `alt` (no value)로 직렬화. `alt=""`와 동등 (SEO/접근성 영향 0). 검증 regex `/alt(?:=""|(?=[\s>]))/g`로 두 형태 동시 매칭.

---

## revalidatePath 동작 검증 결과

- approve 라우트에서 `revalidatePath(/products/${slug})` + `revalidatePath('/products', 'layout')` 호출
- Dev server: 200 응답 정상 (콘솔 에러 없음)
- Vercel Production CDN 무효화 확증은 머지 후 deploy 시점에 별도. 코드 path는 검증됨.

---

## approve 트랜잭션 처리 방식

**RPC 채택** (자율 결정 + 사용자 합의):

- `supabase/migrations/028_approve_seo_draft.sql` 신규
- `approve_seo_draft(p_draft_id, p_processed_description, p_pattern_alts, p_reviewer_id, p_review_note)`
- `SECURITY DEFINER` + `search_path=public` + service_role grant
- `FOR UPDATE`로 draft row 잠금 + status race 차단
- products + product_images 상위 3장 + product_images 4번째+ + draft 4단계 atomic UPDATE

대비 단계별 try/catch 옵션의 단점 (부분 갱신 잔존 + Sentry 수동 복구)을 회피.

API 측 책임:
- `ensureImgAlts(product.description, [], {})` 미리 계산 후 RPC에 인자로 전달
- 4번째+ 패턴 alt를 `buildPatternAlt(product.name, indexFromFour)`로 미리 계산 후 `{image_id, alt_text}[]` JSONB 전달
- description-parser는 SQL에서 불가 → API에서 처리, SQL은 단순 UPDATE만

---

## spec v0.6 정정 후보 (3건)

| # | 항목 | spec v0.5 | 권고 |
|---|---|---|---|
| 1 | §3 핵심 유틸리티 + §12 산출물 인덱스 | `lib/seo/description-parser.ts` Phase 1 산출 | **Phase 2 산출**로 정정. 위치 `src/lib/seo/description-parser.ts`. `supabase/functions/_shared/seo/*`는 Edge worker 전용으로 별도 명시. node-html-parser는 npm + esm.sh 2벌 의존 (양 runtime). |
| 2 | §3 description-parser 코드 블록 | `ensureImgAlts(html)` 단순 시그니처 | **`ensureImgAlts(html, injections, options)`** 확장 시그니처로 정정. injections=[] 빈 배열 호출 시 v0.4 의미 (빈 alt 일괄 삽입) 그대로. |
| 3 | §11.1 vault.secrets `seo_worker_auth` | Phase 2부터 worker → API 호출 시 필요 | **Phase 3부터** 정정. Phase 2 admin API는 worker invoke 없이 `seo_generation_queue` insert만 → SEO_WORKER_AUTH unused. |

---

## 산출 파일

### 신규 (Phase 2)
```
src/
  types/seo.ts                                      # AltInjection, DraftListItem, DraftDetail
  lib/seo/
    description-parser.ts                           # Vercel Node, node-html-parser npm
    main-image-alt.ts                               # buildPatternAlt (Edge 모듈과 동기화)
    drafts.ts                                       # getSeoDraftsPendingPaginatedAdmin / getSeoDraftDetailAdmin
  app/
    api/admin/
      seo-drafts/
        route.ts                                    # GET (목록, limit/offset)
        [id]/route.ts                               # GET + PATCH (Zod 미사용, 수동 검증)
        [id]/approve/route.ts                       # POST (ensureImgAlts + buildPatternAlt + RPC + revalidatePath)
        [id]/reject/route.ts                        # POST
      products/[id]/regenerate-seo/route.ts         # POST (queue insert + 중복 회피)
    admin/seo-drafts/
      page.tsx                                      # Server Component (force-dynamic)
      _components/seo-drafts-client.tsx             # Client (목록 + 미리보기 + 인라인 편집 + 액션 4)
  components/layout/AdminSidebar.tsx                # "SEO Draft 검토" 메뉴 항목

supabase/migrations/028_approve_seo_draft.sql       # RPC 신규 (apply 완료)

scripts/seo-poc/description-parser-node-test.ts     # Vercel Node ensureImgAlts 단위 테스트 13건

docs/seo/phase2-report-2026-05-20.md                # 본 문서

package.json / package-lock.json                    # node-html-parser@7.0.1 (--save-exact)
```

### 변경 (Phase 1 sync)
```
supabase/functions/_shared/seo/description-parser.ts  # 빈 alt 자동 삽입 + 동기화 docstring 추가
```

---

## 운영자 검토 요청 사항

1. **description 재직렬화 ~3% 사이즈 변경** — 검증 2에서 204286 → 197282자. node-html-parser HTML 재직렬화 영향. Phase 3 backfill 전에 운영자가 1건 샘플로 HTML 시각적 비교 (브라우저 렌더링 차이 없음 확증).
2. **`SEO_AI_MODE=live` 운영 상태 — Phase 2 검증 중 $0.0093 실비 발생** (검증 4 재생성). Phase 1 사용자 액션 시 live 등록 후 mock 미복구. Phase 3 운영자 합의 후 backfill 진입 시 비용 캡 모니터링 ($20 cap ≈ 2100건).
3. **`24eaa609` (와이드 슬랙스) 의도된 거절** — Phase 1 mock draft 중 1건이 검증 3 추가 케이스로 rejected 상태. 운영자가 재생성 원하면 admin UI에서 트리거 가능.

---

## Phase 3 진입 시 우려 / 주의 사항

1. **Worker crash stuck `processing` 복구 잡 미구현** (Phase 1 §우려 #2 동일) — backfill 시 worker crash 시 queue stuck. P0 우선순위.
2. **vault.secrets `seo_worker_auth` 등록 절차** — Phase 3에서 worker → API 호출 패턴 도입 시 Vercel env `SEO_WORKER_AUTH` 등록 필요 (spec v0.5 §11.1 — 단 spec v0.6 정정 #3 적용 후).
3. **HTML 재직렬화 동일성 검증** — 운영자 검토 요청 #1 후속.
4. **live 모드 비용 모니터링** — admin dashboard 누적 USD + 월 캡 $20 alert (Phase 3 §5 항목 그대로).
5. **검증 draft 11건 잔존** — Phase 2 검증 후 pending 11건 (12 - approved 1 - rejected 2 + 신규 1). Phase 3 backfill 진입 전에 운영자가 정리 (승인/거절) 권장.

---

## Phase 2 완료 판정

- npx tsc --noEmit: **0 errors** ✅
- npx next lint: **0 warnings/errors** ✅
- npx next build: **exit 0** ✅
- 단위 테스트: **13/13 PASS** ✅
- 통합 검증 1~4: **PASS** ✅
- 통합 검증 5: **시대체 PASS** (단위 + code review) ✅
- 보안 6 layer 유지 (모든 라우트 verifyAdmin + adminLimiter) ✅
- Sentry tag 추가 없음 (Phase 3 항목)

**PR 머지 가능 상태**: ✅

---

## v0.6 → v0.7 후보 변경 (Phase 3 진입 후 검토)

- worker stuck `processing` 복구 잡 패턴 (spec 신규 §FR-6 후보)
- description-parser HTML 동일성 정밀 검증 (운영자 1건 샘플 후)
- 운영자 첫 100건 검토 결과 → 프롬프트 v1.1 튜닝 (spec v0.5 §14 그대로)
- live 모드 누적 비용 모니터링 admin dashboard 항목
