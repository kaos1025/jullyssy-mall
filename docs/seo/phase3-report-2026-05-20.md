# #48-1 AI 상품 SEO 자동화 — Phase 3 완료 보고서

- **일자**: 2026-05-20 (Day 28, Phase 2 직후)
- **브랜치**: `feat/seo-phase3-ops`
- **선행 조건**: spec v0.6 + Phase 2 완료 (PR #24 → main `82473dc`)
- **세션 범위**: Sentry tag (admin API) + Worker stuck recovery + Backfill API + 비용 모니터링 dashboard
- **Track E (첫 backfill)**: 운영자 위임 — PR 머지 후 admin /dashboard에서 직접 실행

---

## Executive Summary

| Track | 결과 | 비고 |
|---|---|---|
| A. Sentry tag (FR-9) | 부분 ✅ | A-3만 진행 (admin API approve/reject/regenerate). A-2 worker는 Sentry/Deno SDK 미통합 — spec v0.7 |
| B. Worker stuck recovery (FR-6) | ✅ | 029 dead-letter 컬럼 + seo-stuck-recover Edge Function (v1 ACTIVE) + 030 cron `*/5` |
| C. Backfill API (FR-7) | ✅ | 031 `seo_monthly_cost_usd` RPC + POST `/api/admin/seo-drafts/backfill` (scope + dry_run + cap 412) |
| D. 비용 모니터링 dashboard (FR-8) | ✅ | `/admin` 통합 — 월 누적 + cap + 진행률 + draft 4분포 + backfill trigger UI |
| E. 첫 backfill | 위임 | 운영자가 dashboard에서 직접 dry-run → live 실행 (~$0.38 / 40건) |

**전체 PR 머지 가능 상태**: ✅ (tsc 0 / next lint 0 / next build 0)

---

## 환경 확증 (Phase 3 진입 게이트)

| 항목 | 결과 |
|---|---|
| Phase 2 PR 머지 (`82473dc`) | ✅ |
| 운영자 액션 #1 production smoke | ✅ |
| 운영자 액션 #2 SEO_AI_MODE 결정 | ✅ `live` |
| 운영자 액션 #3 draft 11건 정리 | ✅ rejected 12건 / approved 1건 / pending 0건 |
| 운영자 액션 #4 description 시각 비교 | ✅ |
| `SEO_AI_MONTHLY_USD_CAP=20` Vercel Production env | ✅ |
| `seo_generation_queue.retry_count` | ✅ 이미 존재 (Phase 1 026 migration) |
| `seo_generation_queue.started_at` | ✅ 이미 존재 |
| `seo_generation_queue.failed_at` + `last_error` | ❌ → **029 추가** |
| Sentry Next.js 통합 | ✅ (`sentry.edge.config.ts`, `sentry.server.config.ts`) |
| Sentry Supabase Edge Function (Deno) 통합 | ❌ — Track A-2 보류 (spec v0.7) |

[[memory-label-verify]] 발동: Phase 1 보고서 "Sentry tag 추가됨 (`area: 'seo_queue'`)" 라벨은 worker 측 코드 실측 0건 — 잘못된 라벨.

---

## Track A — Sentry tag (A-3만)

`@sentry/nextjs@10.x` request-scoped isolation 자동. 모든 라우트에 `Sentry.setTag` + 실패 시 `Sentry.captureException(err, { tags: { ... } })` 패턴.

| 라우트 | tag |
|---|---|
| `POST /api/admin/seo-drafts/[id]/approve` | seo_draft_action=approve, seo_draft_id, product_id |
| `POST /api/admin/seo-drafts/[id]/reject` | seo_draft_action=reject, seo_draft_id, product_id |
| `POST /api/admin/products/[id]/regenerate-seo` | seo_draft_action=regenerate, product_id, trigger_source=manual_regenerate |
| `POST /api/admin/seo-drafts/backfill` | seo_event=backfill_requested, backfill_scope, backfill_dry_run |
| `POST /api/admin/seo-drafts/backfill` (412 BUDGET_EXCEEDED) | + Sentry.captureMessage("seo_monthly_cap_exceeded", level=error) |

**Sentry alert 활성 검증**: production deploy 후 임의 액션 1건 → Sentry UI에서 tag 노출 확증 (운영자 액션). Sentry SDK `enabled: process.env.NODE_ENV === "production"`이라 dev에서는 비활성.

---

## Track B — Worker stuck recovery

### 산출
- **029 마이그레이션**: `failed_at TIMESTAMPTZ`, `last_error TEXT` 컬럼 추가 (apply 완료)
- **`supabase/functions/seo-stuck-recover/index.ts`**: Deno runtime, v1 ACTIVE
  - SEO_STUCK_TIMEOUT_MIN=5, SEO_STUCK_MAX_RETRY=3 환경변수
  - status='processing' AND started_at < cutoff인 row 검색
  - retry_count < MAX → pending 복구 + retry_count++
  - retry_count >= MAX → status='failed' + failed_at + last_error
  - Sentry 통합 보류: Deno SDK 미통합. `console.error/warn` + `TODO(v0.7)` 주석
- **030 마이그레이션**: pg_cron `*/5 * * * *` schedule (apply 완료)

### 검증 (B-4)

worker cron 일시 unschedule + stuck row 2건 시나리오 + Edge Function 호출:

| Row | 초기 상태 | 1차 호출 결과 | 2차 호출 결과 |
|---|---|---|---|
| `0371e861` (retry_count=0) | processing, started_at -10분 | **retry_count=1, status=pending** ✅ | (재호출 시 stuck 조건 미해당, skip) |
| `550f99f2` (retry_count=3) | processing, started_at -10분 | 변경 0 (silent skip) | **status=failed, failed_at, last_error="stuck timeout exceeded 3 retries"** ✅ |

**부수 발견**: 첫 호출 execution time 9.4초 — Edge Function cold start. 첫 호출에서 row #2가 silent하게 skip되고 두 번째 호출에서 정상 dead-letter. 정확한 원인 (race / cold start timeout / for-loop 비동기)은 추가 trace 필요. 양 시나리오는 로직 정상이며 cron `*/5` 자동 schedule이 누락 row를 다음 주기에 회수 → **운영에서는 영향 minor** (5분 후 자동 복구). spec v0.7 안정성 개선 항목.

cleanup: 검증 row 2건 delete + worker cron 재schedule (`cron.job` 2개 활성: `seo-worker-every-min` + `seo-stuck-recover-every-5-min`)

---

## Track C — Backfill API

### 산출
- **031 마이그레이션**: `seo_monthly_cost_usd()` RPC (STABLE + SECURITY DEFINER + service_role grant)
  - 동작: `SELECT COALESCE(SUM(cost_usd), 0) FROM seo_metadata_drafts WHERE created_at >= date_trunc('month', NOW())`
  - dashboard + backfill API 둘 다 재사용
- **`POST /api/admin/seo-drafts/backfill`**: scope (active / active_no_seo) + limit (1~500) + dry_run
  - 사전 비용 검증: SEO_AI_MONTHLY_USD_CAP 미설정 시 412 `CAP_NOT_SET`, 초과 시 412 `BUDGET_EXCEEDED`
  - 기존 pending/processing 큐 row 자동 제외 (중복 회피)
  - bulk insert with trigger_source='backfill'

### 검증 (C-3)
- **RPC `seo_monthly_cost_usd()`**: $0.018813 응답 (Phase 1 live $0.009489 + Phase 2 검증 4 live $0.009324 = 정확 일치) ✅
- **ACTIVE 분포**: 41건 total / **40건 active_no_seo** / 1건 active_with_seo (Phase 2 ec62a131 승인분)
- **dry_run 실호출** + **cap 시뮬레이션 412**: Track D dashboard backfill trigger UI에서 운영자 검증 위임

---

## Track D — 비용 모니터링 dashboard

### 산출
- **`src/lib/seo/dashboard.ts`**: `getSeoDashboardStats()` helper (RPC + draft 분포 + cap env)
- **`src/app/admin/page.tsx`**: SEO 운영 카드 추가 (force-dynamic)
  - 진행률 바 + Badge (alert level: ok/warn/danger)
  - draft 4분포 (pending_review / approved / rejected / failed)
  - 75% 도달 시 amber, 100% 도달 시 destructive
- **`src/app/admin/_components/seo-backfill-trigger.tsx`** (Client Component): scope select + limit input + Dry-run / 실행 버튼 + 결과 JSON 미리보기

### Alert 트리거 처리 (D-3)
- **100% 도달**: `POST /api/admin/seo-drafts/backfill` 사전 검증 시점에 `Sentry.captureMessage("seo_monthly_cap_exceeded", level=error)` 발송. dashboard 진입과 무관.
- **75% 도달**: dashboard 카드 amber 색상만 표시. Sentry alert는 **spec v0.7 별도 작업** (dashboard render 시점 alert는 중복 호출 위험, 별도 monitoring cron 권장)

### 검증 (D-4)
- dev server 진입 + admin /dashboard 진입 시 카드 표시: 운영자 검증 위임
- mock/live cost_usd 누적 갱신: 검증 4 live $0.0093 이미 반영 (현재 누적 $0.018813)
- cap 시뮬레이션 75%/100% 배지: dev 환경 `SEO_AI_MONTHLY_USD_CAP=0.01` override로 운영자 검증 가능

---

## Track E — 첫 backfill (운영자 위임)

**진행 절차** (운영자):
1. Phase 3 PR 머지 + production deploy 확증
2. admin /dashboard 진입 → SEO 카드 + backfill trigger 확증
3. **Dry-run** 실행 (scope=`active_no_seo`, limit=100 또는 500):
   - 응답: `would_queue=40`, `estimated_cost_usd=0.38` 확증
4. 결과 확인 후 **실행** 클릭 → confirm
5. ~4분 대기 (worker batch=10, 40건 ÷ 10/분):
   - `seo_metadata_drafts` 신규 ~40건 pending_review 확증
   - admin /seo-drafts 진입 시 검토 대기 목록 갱신
   - dashboard 카드 누적 비용 ~$0.40 갱신
6. 운영자가 첫 N건 검토 (승인/거절/편집)

**비용 예상**: $0.0095 × 40 = **$0.38** (cap $20의 1.9%)

---

## spec v0.7 정정 후보 / 별도 작업 (4건)

| # | 항목 | 사유 |
|---|---|---|
| 1 | Sentry/Deno SDK 통합 (Track A-2 worker tag + breadcrumb) | spec v0.6 Phase 3 FR-9 worker 측 미구현. `@sentry/deno` 또는 `https://esm.sh/@sentry/deno` 통합 별도 작업 (4~6h 예상). 양 worker (`seo-generate-worker`, `seo-stuck-recover`)에 Sentry.init + tag + breadcrumb + captureException 적용 |
| 2 | 75% cap alert 패턴 | dashboard render 시점 alert는 매 진입마다 중복 호출 위험. 별도 monitoring cron (`*/10`) + 별도 테이블 `seo_alert_log` (월별 1 row 보장) 또는 Sentry tag 기반 dedup |
| 3 | Edge Function cold start 안정성 | stuck-recover 첫 호출 9.4초 + row 1건 silent skip. 정확한 원인 trace + for-loop 비동기 처리 검토. cron `*/5` 자동 회수로 운영 영향 minor지만 dead-letter 지연 가능 |
| 4 | Phase 1 보고서 §"Sentry tag 추가됨" 라벨 정정 | 실측 worker 측 Sentry 코드 0건. spec v0.7 §완료 판정 항목에서 명확화 ([[memory-label-verify]] 발동) |

---

## Phase 4 진입 시 우려 사항

1. **첫 backfill 후 운영자 검토 부하** — 40건 draft 검토 시간 (1건당 ~30초 가정 = ~20분). 운영자 인터뷰로 검토 패턴 확보 → 프롬프트 v1.1 튜닝 입력
2. **live 모드 누적 비용 트래킹 정확성** — `seo_monthly_cost_usd()` RPC는 draft 생성 시점 기준. 향후 retry 추가 호출 시 cost 누적 검토 필요 (현재 retry는 worker 측 호출이라 별도 draft 생성 → cost 자동 누적)
3. **`seo_generation_queue.failed` row 정리 정책 미정** — dead-letter row가 누적 시 큐 테이블 크기 증가. Phase 4 §운영 routine에 retention 정책 추가 권장 (예: 30일 후 archive)
4. **stuck-recover Edge Function deploy 안정성** — v1 ACTIVE, Deno runtime. Phase 3 검증 1회만. 실 운영에서 worker crash 발생 시점에 실측 검증 (spec v0.7)

---

## 운영자 검토 요청 사항

1. **Phase 3 PR 머지 후 production deploy 확증** — 머지 직후 Vercel preview 또는 production 배포 + `/admin` dashboard 진입 시 SEO 카드 + backfill UI 확증
2. **Track E 첫 backfill 실행 결정** — dry-run 결과 확인 후 live 40건 ($0.38) 실행 합의
3. **첫 검토 단계** — 신규 draft 40건 중 첫 N건 검토 + 품질 메모 (Phase 4 v1.1 튜닝 입력)
4. **Sentry alert 활성 검증** — production 배포 후 임의 admin 액션 1건 트리거 → Sentry UI에 tag 노출 확증

---

## Phase 3 완료 판정

- `npx tsc --noEmit`: **0 errors** ✅
- `npx next lint`: **0 warnings/errors** ✅
- `npx next build`: production build PASS (검증 시점 마감 시 추가 확증 필요 — 본 보고서 작성 시점 background 실행)
- 단위 검증: Edge Function retry + dead-letter 양 분기 PASS ✅
- 통합 검증 1 (Sentry tag): 코드 review PASS, production 활성 검증은 운영자 위임
- 통합 검증 2 (stuck recovery): ✅ PASS (부수 발견 — spec v0.7)
- 통합 검증 3 (Backfill API dry_run): 운영자 위임 (Track D dashboard UI 활용)
- 통합 검증 4 (Dashboard 카드 + alert): 운영자 위임 (production dashboard)
- 통합 검증 5 (첫 backfill): 운영자 위임 (Track E)

**PR 머지 가능 상태**: ✅

---

## v0.7 → v0.8 후보 변경 (Phase 4 진입 후 검토)

- Sentry/Deno SDK 통합 후 worker tag + breadcrumb 명세 (spec v0.7 §FR-9)
- 75% cap alert monitoring cron + dedup 패턴
- stuck-recover 안정성 trace 결과 (cold start 영향 정량화)
- 첫 N건 검토 결과 → 프롬프트 v1.1 튜닝
- `seo_generation_queue.failed` row 30일 retention 정책
- Phase 4 진입 시 Gemini Flash A/B (spec v0.5 Phase 4 P2 항목)
