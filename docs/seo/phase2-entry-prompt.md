# #48-1 AI 상품 SEO 자동화 — Phase 2 어드민 UI

## 컨텍스트
- **스펙**: `spec-48-1-ai-product-seo-v0.5.md` (v0.4 → v0.5 변경: image-processor 폐기 + URL source 정착 + user prompt 명세 + 비용 13원/상품 + vault 운영 매뉴얼)
- **Phase 1 보고서**: `docs/seo/phase1-report-2026-05-20.md` (Day 27 산출 가정)
- **Phase 1 완료**: ✅ Day 27 PR #23 squash → main `a756379`
- **사전 조건 충족**:
  - Phase 1 검증 2 live PASS, $0.0095/상품 실측
  - `seo_metadata_drafts` 테이블 production 운영 중
  - 검증 draft 2건 (mock + live) 보존 → **Phase 2 UI 테스트 데이터로 즉시 사용 가능**
  - `lib/seo/description-parser.ts` Phase 1 산출 (Vercel Node runtime 직접 import 가능)
- **예상 작업량**: ~6h (단일 세션 또는 2세션 분할 Claude Code 자율)

## 세션 시작 표준 점검 (Day 20 학습)
- `git status --short` + `git log --oneline -3` 동시 확인
- main HEAD가 `a756379` (Phase 1 squash 머지) 또는 그 이후 hotfix 머지된 상태인지 확증
- Phase 1 잔여 untracked 파일 없음 확인

## Phase 2 진입 전 환경 확증 (spec v0.5 §11.3)

**필수 체크리스트**:
- [ ] vault.secrets `seo_worker_auth` 등록 + Vercel env `SEO_WORKER_AUTH` 동일 값 등록 상태 확증
  - Phase 1에서 worker가 production API를 호출했다면 이미 등록됨
  - 미등록 시 spec v0.5 §11.1 절차로 등록 (Phase 2 첫 step에서 보강)
- [ ] `SEO_AI_MODE` Vercel env 등록 확증 (Production: `mock` 권장 — Phase 2 UI 검증 단계는 mock 충분)
- [ ] `seo_metadata_drafts` DB에 Phase 1 검증 draft 2건 잔존 확증 (Phase 2 UI 테스트 데이터)
  - `SELECT id, status, product_id, created_at FROM seo_metadata_drafts ORDER BY created_at DESC LIMIT 5;`
  - 2건이 `status='pending_review'` 상태로 있어야 함

**미충족 시 처리**:
- vault/env 미등록 → 등록 후 진행 (10분)
- 검증 draft 소실 → Phase 2 첫 검증 시 mock 모드로 1건 재생성 (5분)

---

## 핵심 정책 (spec v0.5 기반)

### Description Parser Import 경로 결정 (PM 결정 영역 → 본 명세에서 확정)

**문제**: Phase 1 `lib/seo/description-parser.ts`는 `node-html-parser@7.0.1` 사용. Edge runtime에서는 Phase 1에서 검증되지 않음 (URL detour로 Edge에서 description 파싱 안 함).

**결정**: **Phase 2 어드민 승인 라우트는 Vercel Node runtime이므로 `node-html-parser` 직접 import OK**.
- Next.js API route는 기본 Node runtime (Edge 명시 안 했으면)
- `node-html-parser`는 npm 패키지로 Node runtime에서 정상 동작 (Phase 0 PoC + Phase 1 단위 테스트로 확증)
- Edge runtime 명시(`export const runtime = 'edge'`) **금지**

### 보안 정책 (모든 API)
- 모든 라우트: `verifyAdmin` (Phase 1 보안 6 layer 중 하나)
- 모든 라우트: `adminLimiter` (60/60s)
- 추가 사용자 input 검증: Zod schema (인라인 편집 필드 검증)

### UI 라이브러리
- shadcn/ui 기반 (쥴리씨 디자인 시스템 SSOT)
- 디자인 토큰: `docs/design-system/project/` 참조
- 어드민은 디자인 우선순위 낮음 — 기능 충실 + 디자인 시스템 토큰 일관성만 유지

---

## Track A. `/admin/seo-drafts` 페이지 + GET API (~3h)

### A-1. GET `/api/admin/seo-drafts`

**기능**:
- pending_review 상태 draft 목록 반환
- 페이지네이션 (`?limit=20&offset=0`)
- 정렬: created_at desc (최신순)

**응답 구조**:
```typescript
{
  drafts: Array<{
    id: string;
    product_id: string;
    product_name: string;       // products JOIN
    product_thumbnail: string;  // product_images 1번
    meta_title: string;
    meta_description: string;
    search_tags: string[];
    image_alt_texts: Array<{ image_index: number; alt_text: string }>;
    model: string;
    prompt_version: string;
    cost_usd: number;
    image_count: number;
    created_at: string;
  }>;
  total: number;  // 페이지네이션용
}
```

**보안**: `verifyAdmin` + `adminLimiter`.

### A-2. `/admin/seo-drafts` 페이지 (Server Component)

**파일**: `src/app/admin/seo-drafts/page.tsx`

**구조** (참조 — 디자인 자율):
- 헤더: "AI SEO Draft 검토" + 누적 카운트 (pending: N건)
- 좌측 (모바일은 상단): draft 목록 (썸네일 + 상품명 + 생성일)
- 우측 (모바일은 하단): 선택된 draft 미리보기 패널 (A-3)
- 페이지네이션 (하단)

**비고**: Server Component에서 `verifyAdmin` 호출 + `createAdminClient`로 초기 데이터 fetch (Day 18 학습: admin 페이지 Full Route Cache 회피).

### A-3. 미리보기/편집 컴포넌트 (Client Component)

**파일**: `src/app/admin/seo-drafts/_components/draft-preview.tsx` (또는 동등 경로)

**섹션**:
1. **이미지 영역**:
   - 메인 갤러리 상위 3장: 각 이미지 + AI 생성 alt text (인라인 편집 input)
   - 4번째 이상 이미지: 썸네일 + 규칙 패턴 alt 미리보기 (편집 불가, 정보 표시)
2. **메타데이터 편집** (인라인 input):
   - `meta_title` (60자 제한, 카운터 표시)
   - `meta_description` (155자 제한, 카운터 표시)
   - `search_tags` (배열 편집, 5~10개 제한)
3. **요약 정보** (편집 불가):
   - 모델 / prompt_version / cost_usd / image_count / created_at
4. **액션 버튼**:
   - "변경 저장" (PATCH) — 인라인 편집 내용만 저장, 상태 유지
   - "승인 및 적용" (POST approve) — 저장 + 적용
   - "거절" (POST reject) — 보관
   - "재생성" (POST regenerate-seo) — products 측 트리거

**검증 (클라이언트)**:
- meta_title ≤ 60자, meta_description ≤ 155자
- search_tags 길이 5~10
- 빈 alt_text 허용 X (3장 모두 필수)

---

## Track B. 승인/거절/재생성 API (~2h)

### B-1. PATCH `/api/admin/seo-drafts/[id]` (인라인 편집 저장)

**기능**: draft 필드 수정 (status는 유지 — `pending_review`)

**body Zod schema**:
```typescript
const updateDraftSchema = z.object({
  meta_title: z.string().max(60).optional(),
  meta_description: z.string().max(155).optional(),
  search_tags: z.array(z.string()).min(5).max(10).optional(),
  image_alt_texts: z.array(z.object({
    image_index: z.number().int().min(0).max(2),
    alt_text: z.string().max(100)
  })).optional(),
});
```

**처리**:
- draft 조회 → status가 `pending_review`가 아니면 409 Conflict
- 부분 업데이트 (NULL 또는 부재 시 기존 값 유지)
- `updated_at = NOW()`

**보안**: verifyAdmin + adminLimiter.

### B-2. POST `/api/admin/seo-drafts/[id]/approve`

**기능**: draft를 products + product_images에 적용 + status `approved` 갱신.

**처리 순서** (트랜잭션 권장):
1. draft 조회 → status `pending_review` 검증
2. product 조회
3. product_images 조회 (sort_order asc)
4. **products 업데이트**:
   - `meta_title = draft.meta_title`
   - `meta_description = draft.meta_description`
   - `search_tags = draft.search_tags`
   - `description = ensureImgAlts(product.description)` — `node-html-parser` 직접 import
     - description NULL이면 NULL 유지 (no-op)
   - `seo_updated_at = NOW()`
5. **product_images 상위 3장**: AI alt 적용
   - `for ({image_index, alt_text} of draft.image_alt_texts)`:
     - `if (images[image_index]) update product_images[image_index].alt_text = alt_text`
6. **product_images 4번째+**: 규칙 패턴
   - `for (let i = 3; i < images.length; i++)`:
     - `update images[i].alt_text = buildPatternAlt(product.name, i - 2)`
7. **draft 갱신**: `status='approved'`, `reviewed_by=req.user.id`, `reviewed_at=NOW()`, `review_note=req.body?.note`

**원자성**:
- Supabase는 클라이언트 트랜잭션 미지원 → 각 단계 try/catch + 실패 시 rollback 로직 또는 Postgres function (RPC) 1회 호출 권장
- **권장**: `approve_seo_draft(draft_id UUID)` Postgres function 1개로 1~6 처리 (Day 18 RPC 학습 — DB function이 코드 측 SHIPPING_CONFIG처럼 외부 의존이 없을 때만 권장. 여기는 외부 의존 없음)
- 미선택 시 단계별 try/catch + Sentry log

**파괴 부작용**:
- products + product_images 갱신은 사용자 노출 측 영향
- 캐시 무효화: `revalidatePath('/products/[slug]')` 호출 권장 (Day 18 학습 — admin mutation 후 revalidatePath)
  - slug 모를 시 `revalidatePath('/products', 'layout')` 또는 `revalidateTag('products')`

**보안**: verifyAdmin + adminLimiter.

### B-3. POST `/api/admin/seo-drafts/[id]/reject`

**기능**: draft status `rejected` 갱신 + 보관.

**처리**:
- draft 조회 → status `pending_review` 검증
- `status='rejected'`, `reviewed_by`, `reviewed_at`, `review_note` 갱신
- products / product_images 측 변경 0

**보안**: verifyAdmin + adminLimiter.

### B-4. POST `/api/admin/products/[id]/regenerate-seo`

**기능**: 특정 product에 대해 SEO 재생성 큐 등록.

**처리**:
- product 조회 → status `ACTIVE` 또는 `DRAFT` 검증
- `seo_generation_queue` insert:
  - `product_id`
  - `status='pending'`
  - `trigger_source='manual_regenerate'`
- 기존 pending row 있으면 중복 등록 회피 (옵션: 기존 row reset 또는 409 Conflict)

**보안**: verifyAdmin + adminLimiter.

---

## Track C. ensureImgAlts Vercel Node runtime 적용 + 승인 로직 확정 (~1h)

### C-1. description-parser import 경로 확정

**파일**: `src/app/api/admin/seo-drafts/[id]/approve/route.ts`

```typescript
import { ensureImgAlts } from '@/lib/seo/description-parser';
// node-html-parser는 dependencies로 이미 등록됨 (Phase 1)
// Vercel Node runtime이 기본 (Edge runtime 명시 X)
```

**검증**:
- 라우트 핸들러 상단에 `export const runtime = 'edge'` **없음** 확증
- npm/pnpm `node-html-parser`가 dependencies에 등록 (devDependencies X)

### C-2. ensureImgAlts(null) 동작 단위 테스트

**파일**: 기존 `lib/seo/description-parser.test.ts` (Phase 1 산출) 또는 신규

- `ensureImgAlts(null) === null` 케이스 추가
- vitest 인프라 없으면 임시 스크립트로 OK (PM 자율 영역 — Phase 2 시점에 vitest 도입 비용 회수 가치 판단)

### C-3. revalidatePath 정확 경로 결정

**권장 패턴** (Day 18 학습):
```typescript
import { revalidatePath } from 'next/cache';

// 승인 라우트 끝
await supabase.from('seo_metadata_drafts').update({...}).eq('id', id);
revalidatePath(`/products/${product.slug}`); // 단건
revalidatePath('/products', 'layout'); // 목록 (옵션)
```

**비고**: slug 모를 시 (예외 상황)에는 `revalidateTag` 또는 `revalidatePath('/', 'layout')` 광범위 revalidate 보수적 선택.

---

## 검증 시나리오 (Phase 2 완료 조건)

### 통합 검증 1: 인라인 편집 → 저장
1. `/admin/seo-drafts` 진입 → Phase 1 검증 draft 2건 중 1건 선택
2. meta_title 편집 (예: 마지막에 " | 데일리" 추가)
3. "변경 저장" 클릭 → 200 OK
4. 페이지 새로고침 → 변경 사항 반영 확증
5. status 여전히 `pending_review` 확증

### 통합 검증 2: 첫 승인 흐름 (Phase 1 검증 draft 활용)
1. `/admin/seo-drafts` 진입 → Phase 1 mock 검증 draft 선택
2. 미리보기 패널 확증:
   - 메인 이미지 상위 3장 + AI alt text 3개 표시
   - 4번째+ 이미지가 있으면 규칙 패턴 alt 미리보기 표시
3. "승인 및 적용" 클릭 → 200 OK
4. DB 검증:
   - `products.meta_title`, `meta_description`, `search_tags`, `seo_updated_at` 갱신 확증
   - `product_images` 상위 3장 alt_text 갱신 확증 (image_index 0/1/2 → 해당 row)
   - 4번째+ 이미지 alt_text 규칙 패턴 갱신 확증
   - draft status `approved` + reviewed_by + reviewed_at 기록 확증
5. `/products/[slug]` 페이지 새로고침 → revalidatePath 동작 확증 (메타 태그 갱신, view-source로 meta_title 확증)

### 통합 검증 3: 거절 흐름
1. Phase 1 검증 draft 1건 선택
2. "거절" 클릭 → 200 OK
3. DB 검증:
   - draft status `rejected` 갱신
   - products / product_images 변경 0 확증

### 통합 검증 4: 재생성 흐름
1. 임의 product → "재생성" 클릭 → 200 OK
2. `seo_generation_queue` 신규 row 1건 생성 확증
3. 1분 후 worker pickup → 신규 draft 1건 생성 확증
4. `/admin/seo-drafts` 목록에 신규 draft 노출 확증

### 통합 검증 5: description NULL 케이스 승인
1. Phase 1 검증 draft 중 description NULL 상품에 해당하는 draft 선택 (또는 신규로 1건 생성)
2. "승인 및 적용" 클릭
3. DB 검증:
   - `products.description` NULL 그대로 (no-op 동작 확증)
   - meta_title/description/tags + product_images alt_text는 정상 적용

---

## Risks — Phase 2 진입 시 발생 가능 시나리오

| Risk | 발생 시 PM 보고 |
|---|---|
| description-parser Edge runtime 잘못 import 시도 | Vercel Node runtime 명시 + node-html-parser dependencies 확증 후 재진입 |
| ensureImgAlts(null) 단위 테스트 미통과 | 즉시 보고 → spec v0.6 (description-parser 로직 수정) |
| approve 라우트 트랜잭션 부분 실패 | 권장 RPC 패턴 또는 Sentry log + 수동 재실행 매뉴얼 (운영자 부담은 검증 시점에만) |
| revalidatePath 미동작 (CDN 캐시 잔존) | 광범위 revalidate (`revalidatePath('/', 'layout')`) 폴백 + spec v0.6 |
| **Phase 1 검증 draft 2건 소실** | 즉시 mock 모드로 1건 재생성 (5분) — 테스트 데이터 보충 |
| Phase 1 worker가 vault.secrets 미사용했을 가능성 | spec v0.5 §11.1 절차로 등록 후 Phase 2 진행 |
| 어드민 UI 디자인 시스템 토큰 일관성 부족 | 디자인 우선순위 낮음 — 기능 충실 우선, Phase 3 또는 후속 정리 작업 |

**원칙**: 위 Risk 중 하나라도 트리거되면 작업 중단 + PM 보고. 임의 결정 금지.

---

## 자율 영역 (Claude Code 결정)

- 브랜치명 (`feat/seo-admin-ui` 권장 정도, 자율)
- 커밋 분리 단위 (Track A/B/C 단위 또는 더 세분화)
- 페이지네이션 형태 (limit/offset 또는 cursor 자율)
- shadcn 컴포넌트 선택 (Card / Dialog / Form / Input / Textarea / Button 등 자율)
- approve 라우트 트랜잭션 처리 방식 (Postgres RPC vs 단계별 try/catch — 단, RPC 선택 시 마이그레이션 027 산출 필요)
- vitest 인프라 도입 여부 (Phase 2 시점에 회수 가치 판단, 미도입 시 임시 스크립트로 단위 테스트 OK)
- 일괄 승인 UI 포함 여부 (Phase 2 선택 — 미포함 권장, 운영 데이터 확보 후 도입)
- 미리보기 패널 모바일 레이아웃 (PM 권장: 모바일은 상단 목록 → 하단 상세 스택, 자율)

## PM 결정 영역 (보고 후 진행)

- spec v0.6 필요 여부 (Risk 트리거 시)
- Phase 3 진입 시점 (Phase 2 완료 후 별도 세션)
- backfill 실행 시점 (Phase 3, 운영자 합의 필요)
- `SEO_AI_MODE=live` 전환 시점 (Phase 3 운영자 합의 필요)
- vault.secrets 등록 운영자 위임 vs Claude Code 자율 등록 (현 단계 운영자 권장)

---

## Phase 2 완료 보고서 필수 항목

- Track A/B/C 각각 완료 상태
- description-parser import 경로 결정 결과 (Vercel Node 직접 import 확정)
- 통합 검증 1~5 결과
- ensureImgAlts(null) 단위 테스트 결과
- revalidatePath 동작 검증 결과
- approve 트랜잭션 처리 방식 (RPC vs try/catch)
- spec v0.6 정정 필요 사항 (있다면)
- Phase 3 진입 시 발견된 우려 사항 (있다면)
- 운영자 검토 요청 사항 (예: 어드민 승인 UI 워크플로우 합의)

---

## 다음 액션

1. 표준 점검 (`git status` + `git log`) 후 진입
2. 환경 확증 (vault.secrets + SEO_AI_MODE + 검증 draft 2건 잔존)
3. Track A → B → C 순서 권장 (UI → API → 승인 로직)
4. 각 Track 완료 시 단위 커밋 또는 PR
5. 통합 검증 1~5 통과 시 Phase 2 완료 보고서 산출 → PM(claude.ai) Phase 3 진입 결정
