# #48-1 AI 상품 SEO 자동화 — Phase 0 PoC 보고서

- **일자**: 2026-05-19
- **브랜치**: main (Phase 0 단계 PoC만 산출, 머지 vs PoC 브랜치 보관은 PM 결정 영역)
- **트리거**: feat/seo-foundation 머지 완료 (Day 19 PR #14) + Day 18 결제 보안 정리 완료
- **세션 범위**: Phase 0 PoC only. Phase 1 진입은 본 보고서 검토 후 별도 세션에서 결정

---

## Executive Summary

| Task | 결과 | Risk 트리거 |
|---|---|---|
| A. DB 스키마 + 마이그레이션 026 | ✅ 026 SQL 초안 산출 + description=HTML 확정 | X |
| B-1. 이미지 처리 라이브러리 | ✅ `@jsquash/jpeg` + `@jsquash/resize` 확정 (Deno 검증) | X |
| B-2. HTML 파서 | ✅ `node-html-parser@7.0.1` 확정 (3 case PASS) | X |
| C. Anthropic 이미지 토큰 실측 | ✅ 1551 tokens 측정 — spec 가정의 약 절반 | X (비용 여유 방향) |

**Phase 1 진입 권고**: 가능. 단 spec v0.4 minor 정정 4건 선반영 권장.

---

## Task A. DB 스키마 점검 + 마이그레이션 026 초안

### 산출
- `supabase/migrations/026_seo_metadata.sql` — spec §3 그대로 + `search_tags` 중복 ADD 제외

### DB diff (실측)
**products — 신규 추가 3건**: `meta_title`, `meta_description`, `seo_updated_at`
- 이미 존재: `slug`(005), `search_tags text[] DEFAULT '{}'`(008), `free_shipping`(013), `naver_product_no`, `description`, `material`, `care_info`

**product_images — 신규 추가 1건**: `alt_text`
- 이미 존재: `sort_order int DEFAULT 0`, `url`, `is_thumbnail`

**신규 테이블 2건** (spec §3 그대로):
- `seo_metadata_drafts` (AI 초안 + 검토 상태)
- `seo_generation_queue` (생성 작업 큐)

### 데이터 분포
| 항목 | 값 | 메모 |
|---|---|---|
| products 총 / ACTIVE | 70 / 41 | Day 20 SLUG-BACKFILL-1 카운트와 일치 (메모리 검증 ✅) |
| description NULL | 12건 | ACTIVE 41건 중 일부 description 없음 (Phase 1 처리 필요) |
| description HTML+`<img>` | 57건 | description 보유 58건 중 57건 |
| sort_order NULL | **0건** | **Risk 트리거 안됨** ✅ |
| sort_order min/max/avg | 0 / 9 / 4.35 | 정상 (0부터 시작) |
| product_images 총 | 580장 / 평균 8.3장/상품 | |
| search_tags 채워진 건 | 1건 | 008 도입했으나 사실상 미사용 |

### description 구조 판정: **HTML 확정 (B-2 진행)**
모든 sample이 네이버 스마트에디터 형식 (`se-viewer se-theme-default`, `se-component se-text` 등 SE prefix 클래스). 길이 145KB ~ 247KB.

```html
<div class="se-viewer se-theme-default" lang="ko-KR">
  <!-- SE_DOC_HEADER_START -->
  <div class="se-main-container">
    <div class="se-component se-text se-l-default" id="SE-...">
      ...
```

---

## Task B-1. 이미지 처리 라이브러리 PoC

### 산출
- `supabase/functions/seo-poc/index.ts` — Edge Function 형태 (npm: import, **production runtime 미검증** — Phase 1 첫 작업으로 보류)
- `scripts/seo-poc/image-processor-test.ts` — Deno 단독 PoC (esm.sh import)
- `lib/seo/image-processor.ts` — Phase 1 골격 (시그니처/타입만)

### 검증 환경
- supabase functions serve는 Docker 필요 → **Docker 미설치로 사용 불가**
- 대안: Deno 2.7.14 단독 설치 + esm.sh CDN import로 격리 실행
- **Production Edge Runtime 미검증 — Phase 1 첫 작업으로 보류**

### 라이브러리 확정
- `@jsquash/jpeg@1.6.0` (decode + encode)
- `@jsquash/resize@2.1.0`
- 우선순위 1 후보 첫 시도 성공 → image-magick WASM / 외부 서비스로 fallback 불필요

### 실측 결과 — 2건
**1) 작은 이미지 (1024×1536, 649KB)**
| 단계 | ms |
|---|---|
| fetch | 504 (cold) / 166 (warm) |
| decode | 787 / 383 |
| resize | 0 (1568 미만, 스킵) |
| encode | 951 / 563 |
| base64 | 23 / 14 |
| **total** | **2264 / 1126** |

**2) 큰 이미지 (3024×3572, 4.2MB → 1327×1568, 579KB)**
| 단계 | ms |
|---|---|
| fetch | 708 |
| decode | 563 |
| resize | 1710 |
| encode | 773 |
| base64 | 19 |
| **total** | **3773** |

- ✅ 5000ms 예산 OK (양 케이스)
- ✅ 네이버 pstatic fetch 가능 (hotlink/Referer 차단 없음)
- ✅ longest-edge 1568 정확 적용

### 호스팅 분석
- 580장 중 **577장 (99.5%)이 네이버 pstatic** (`shop-phinf.pstatic.net`)
- Supabase Storage 3장
- → **Supabase Storage transformation API 후보 탈락**. 모든 이미지 외부 fetch 필요. spec §4 비용 가정이 외부 fetch 전제인지 v0.4에서 명시 필요.

---

## Task B-2. HTML 파서 PoC

### 산출
- `scripts/seo-poc/description-parser-test.ts` — 3 case 검증
- `lib/seo/description-parser.ts` — Phase 1 골격

### 라이브러리 확정
- `node-html-parser@7.0.1` (esm.sh / npm 양쪽 호환, Deno 의존성 자동 해결)
- cheerio 대안 시도 불필요

### 검증 결과 — 3 case 전부 PASS
| Case | 설명 | 결과 |
|---|---|---|
| 1 | fixture 4 img (없음/빈alt/기존alt/자기닫힘) | total 4 / injected 3 / preserved 1 ✅ |
| 2 | 빈 HTML | crash 없음 ✅ |
| 3 | 모든 img에 기존 alt | injected 0 / preserved 2 (덮어쓰기 금지) ✅ |

### 실측 — 네이버 SE description 분포 (sample 5건)
| 상품 sample | img_total | empty_alt | filled_alt |
|---|---|---|---|
| 1 | 99 | 99 | 0 |
| 2 | 60 | 60 | 0 |
| 3 | 63 | 63 | 0 |
| 4 | 41 | 41 | 0 |
| 5 | 40 | 40 | 0 |

- **모든 네이버 SE `<img>`는 alt="" (값 비어있음)** → 덮어쓰기 충돌 우려 없음
- 한 description 당 img **40~99개** — spec FR-2 B "최대 3개" 제한 합리성 확인 (전체 alt 생성 시 비용 폭증)

---

## Task C. Anthropic 이미지 토큰 실측

### 산출
- `scripts/seo-poc/anthropic-token-test.ts` — claude-haiku-4-5 2회 호출 (image+text / text only)

### 측정 방법
같은 prompt에 대해:
1. 이미지 포함 호출 → `usage.input_tokens` = 이미지 + 텍스트 토큰
2. 텍스트만 호출 → `usage.input_tokens` = 텍스트 토큰
3. 차이 = 이미지 토큰

### 실측 결과
- **모델**: claude-haiku-4-5-20251001
- **이미지**: 1327×1568, 579KB (B-1 산출 base64 사용)

| 호출 | input_tokens | output_tokens | latency |
|---|---|---|---|
| 이미지 + 텍스트 | 1589 | 64 | 2158ms |
| 텍스트만 | 38 | 61 | 1166ms |
| **차이 (이미지 토큰)** | **1551** | - | - |

### spec §4 가정 대비
- spec 가정: 1568×1568 ≈ **3275 tokens**
- 실측: 1327×1568 (84.6% 면적) → **1551 tokens**
- **variance: -53%** (spec 가정의 약 절반)
- Risk 매트릭스 "C 실측 +20% 초과"는 비용 증가 방향 → **트리거 X** (비용 여유 ↑ 방향)

### 비용 재계산 (3장 multimodal, $1/$5 per MTok 가정)
> ⚠️ Haiku 4.5 정확 단가는 spec §4 본문 또는 Anthropic 공식 문서로 정정 필요. 본 계산은 일반 단가 추정.

- 상품당 input tokens: text(38) + 3 × image(1551) = **4691**
- 상품당 output tokens: 400 (spec §4 가정 — 정확치 spec 본문 필요)
- 상품당 비용: input $0.00469 + output $0.002 = **$0.006691**
- $20 캡 = **2989 상품** (spec 가정 1000건 대비 약 3배 여유)

---

## spec 수정 사항 (v0.4 minor 정정 권고)

| # | 수정 항목 | 사유 |
|---|---|---|
| 1 | 마이그레이션 파일명 `015_seo_metadata.sql` → `026_seo_metadata.sql` | 015는 `015_add_review_tag_columns.sql`로 이미 점유 |
| 2 | `ALTER TABLE products ADD COLUMN search_tags TEXT[]` 제거 | 008에서 `text[] DEFAULT '{}'`로 이미 추가됨 (중복 ADD 시 에러) |
| 3 | §4 토큰 가정 "1568×1568 ≈ 3275 tokens" 정정 | 실측 1327×1568 = 1551 tokens. 1568² 가정 시 약 1832 tokens 추정 (실측 / 면적비율 환산). spec 추정의 약 56% |
| 4 | §4 비용 가정 보정 | 토큰 실측 기반 시 $20 캡 ≈ 약 3000건 처리 가능 (spec 1000건의 3배). 단 Haiku 4.5 정확 단가 본문 명시 필요 |

추가 메모:
- 99.5% 이미지가 네이버 pstatic 호스팅 → Supabase Storage transformation API 사용 불가. 모든 이미지 외부 fetch 전제. spec §4가 이 가정을 포함하는지 확인 필요
- description NULL 12건 (ACTIVE 41건 중) — Phase 1에서 description 없는 상품의 SEO 생성 fallback 전략 명시 필요
- 한 description 당 `<img>` 40~99개 → spec FR-2 B "최대 3개" alt 생성 제한은 합리적

---

## Risk 매트릭스 발동 여부

| Risk | 트리거? | 비고 |
|---|---|---|
| B-1 모든 라이브러리 실패 | ❌ | 우선순위 1 (`@jsquash/jpeg`+`@jsquash/resize`) 첫 시도 성공 |
| description plain text 판정 | ❌ | HTML 확정 (네이버 SE 형식) |
| C 실측 토큰 +20% 초과 | ❌ | -53% 이므로 비용 여유 방향, 트리거 X |
| `sort_order` NULL 다수 | ❌ | 0건, 정상 분포 |

**모든 Risk 트리거 안됨 — Phase 1 진입 차단 사유 없음.**

---

## Phase 1 진입 시 첫 작업 후보 (PM 결정용)

1. **마이그레이션 026 production apply** (Supabase Studio 또는 supabase db push)
2. **Edge Function production deploy + runtime 실측** (Docker 미설치로 로컬 미검증)
3. **ANTHROPIC_API_KEY Vercel env Sensitive 등록** (현재 .env.local만)
4. spec v0.4 minor 정정 (위 4건)
5. `lib/seo/image-processor.ts` + `lib/seo/description-parser.ts` 본문 구현 (PoC 코드 이식)

---

## 산출 파일 목록

```
supabase/
  migrations/026_seo_metadata.sql           # Task A
  functions/seo-poc/index.ts                # Task B-1 (Edge Function 형태, runtime 미검증)
  config.toml + .gitignore                  # supabase init 산출

scripts/seo-poc/
  image-processor-test.ts                   # Task B-1 (Deno 검증 스크립트)
  description-parser-test.ts                # Task B-2 (Deno 3 case PASS)
  anthropic-token-test.ts                   # Task C (1551 tokens 실측)

lib/seo/
  image-processor.ts                        # Phase 1 골격 (시그니처)
  description-parser.ts                     # Phase 1 골격 (시그니처)

docs/seo/
  phase0-report-2026-05-19.md               # 본 문서
```

## 환경 변경 사항
- `supabase init` 실행 → `supabase/config.toml`, `supabase/.gitignore` 추가
- `winget install DenoLand.Deno` → Deno 2.7.14 user-level 설치
- Docker / Supabase CLI Edge Function 컨테이너 사용 없음
