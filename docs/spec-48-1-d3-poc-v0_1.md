# #48-1 Phase 3 후속 — D3 PoC 명세 v0.1

> **description 완전 교체 정책** vs **v0.6 보수적 정책 (alt만 처리)** 비교 검증

## 0. Meta

- **작성일**: 2026-05-22 (Day 30)
- **버전**: v0.1 (초안)
- **상태**: PM 승인 대기 + 트리거 시점 결정 대기
- **선행 의존성**: Phase 3 완료 ✅ (Day 28), v0.6 정책 baseline 90% 승인률 확보 ✅
- **후속 의존성 가능**: SEASONAL-BACKFILL-PLAN (P2, 8월 말~9월 초)
- **예상 작업량**: Dev 4~6h + 운영자 검수 30~60m + PM 분석 30m
- **본 명세는 PoC 단위. PoC 결과 기반으로 v0.7 정식 명세 진입 여부 결정**

---

## 1. 배경 & 목적

### 배경

- GSC "크롤링됨 - 색인이 생성되지 않음" 1건 (보석버튼 가디건 PDP, 2026-05-20 크롤링) 발견
- PDP 분석 결과 **thin content + 스마트스토어 중복 콘텐츠** 패턴 확인
  - PDP unique text ~71자 (셀링포인트 3줄)
  - boilerplate ~310자 (모든 PDP 공통 추정)
  - 메인 이미지에 텍스트 박힘 (인덱싱 불가)
  - 상품명/셀링포인트가 스마트스토어 동일 상품과 일치 추정
- 봄 41건 ACTIVE 전체가 동일 패턴 (스마트스토어 임포트 + CSS 깨짐)
- 운영자 commerce 판단으로 봄 시즌 잔여 30건 8월 말~9월 초 SEASONAL-BACKFILL-PLAN 트리거 예정

### 가설

v0.6 보수적 정책 (description 본문 유지 + 빈 alt만 처리) 은 **스마트스토어 임포트 콘텐츠 패턴에 대해 색인 보류를 완전 해소하지 못할 가능성**이 있다. description 완전 교체 (스마트스토어 HTML 제거 + AI 자연어 description 생성)가 더 강한 SEO 효과를 갖지만, 운영자 검수 부담 증가 + 90% 승인 baseline 변경 risk가 있다.

### PoC 목적

3가지 데이터 확보:

1. **품질**: 운영자가 v0.6 정책 draft vs 신규 정책 draft 중 어느 쪽을 더 선호하는가
2. **비용**: 신규 정책의 토큰 비용 증가 정량 (예상 +30~70% per product)
3. **운영 부담**: 운영자 검수 시간 증가 정량 (예상 alt 검수 30초/건 → description 검수 1~2분/건)

### Non-Goals

- 봄 41건 일괄 적용 결정 (PoC 결과 후 정식 spec v0.7로 분리)
- Phase 4 prompt v1.1 튜닝과 합산 (별도 트랙)
- SEASONAL-BACKFILL-PLAN 차단 (PoC 결과 무관하게 8월 말 진입 가능)

---

## 2. PoC 범위 (Scope)

### 샘플 상품 선정

- **N건**: 3건
- **카테고리 기준**: 시즌 무관 카테고리 (가방, 악세서리) 우선
  - 봄/가을 시즌 의류는 시즌 윈도우 영향 받아 PoC 노이즈 증가
- **상태 기준**: ACTIVE_NO_SEO (Phase 3 backfill 미실행분)
- **운영자 선정**: 비교 검수가 가능한 상품 3건 (스마트스토어 임포트 HTML 길이 다양성 확보)

### Scope In

- description 완전 교체 정책 구현 (PoC 분기)
- description-parser 확장 (spec 정보 추출 — 사이즈/소재/세탁법)
- prompt 변경 (description 생성 모드 추가)
- admin UI 비교 미리보기 (v0.6 vs PoC 사이드바이사이드)
- 운영자 비교 검수 워크플로우

### Scope Out

- 봄 41건 또는 잔여 30건 일괄 적용
- CSS 깨짐 정비 (D4 별도 트랙 유지)
- 신규 입고 자동화 워크플로우 변경 (D1, v0.6 정책 유지)
- 점진 검수 흐름 (D2, Phase 4 명세 시점에 재고려)

---

## 3. 의사결정 기준 (PoC 통과 임계값)

PoC 결과가 다음 4가지 기준을 **모두** 통과하면 v0.7 정식 명세 진입:

| 기준 | 임계값 | 측정 방법 |
|---|---|---|
| 운영자 선호도 | ≥ 70% (3건 중 2건 이상 PoC draft 선택) | 사이드바이사이드 비교 후 운영자 명시 선택 |
| 비용 증가 | < +50% per product (vs v0.6 기준 $0.0095) | Anthropic API usage log 직접 측정 |
| 검수 시간 증가 | < 2배 (vs v0.6 평균 30초/건) | 운영자 timer 기록 |
| spec 정보 손실 | 0건 (사이즈/소재/세탁법 누락) | 구조화 메타 vs 임포트 HTML 텍스트 비교 |

**1~2개 미달**: 부분 채택 + 정책 조정 후 PoC 재실시 또는 v0.7 정책 분기 (예: 카테고리별 다른 정책)
**3개 이상 미달**: v0.6 정책 유지 + D3 close

---

## 4. 구현 영역 (변경 위치 + 근거)

### 4.1 prompt 분기 추가

**위치**: `src/lib/seo/prompts.ts`

**변경**: prompt v1.0에 `description_mode` 파라미터 추가
- `description_mode='preserve'` (v0.6 기본값) — 기존 동작 유지
- `description_mode='replace'` (PoC 신규) — 스마트스토어 HTML 완전 제거 + 자연어 description 생성

**근거**: v0.6 정책 baseline (90% 승인률)을 깨뜨리지 않도록 prompt 분기. 기존 호출자는 모두 default `preserve`라 회귀 risk 0.

**Claude Code 자율 결정 영역**:
- prompt 본문 구체 표현 (단, "이미지에 박힌 텍스트 추정 금지" 원칙은 유지)
- description 생성 길이 target (200~400자 권장, 본 명세 강제 X)

### 4.2 description-parser 확장

**위치**: `src/lib/seo/description-parser.ts` + `supabase/functions/_shared/seo/description-parser.ts` (Phase 1 dual runtime 유지)

**변경**: spec 추출 함수 신규 추가
- `extractSpecMetadata(html): SpecMetadata`
- `SpecMetadata` 타입: `{ size?: string[], material?: string, washCare?: string, model_info?: string }`
- 휴리스틱 우선 (정규식 + DOM traversal), AI 호출 불필요

**근거**: AI description 생성 시점에 spec 데이터를 **별도 메타로 보존**해야 정보 손실 0 달성 가능. AI input에는 raw HTML 텍스트 + spec 메타 양쪽 모두 전달.

**Claude Code 자율 결정 영역**:
- spec 추출 휴리스틱 (table 기반 vs li 기반 vs 정규식)
- spec 매칭 패턴 (PoC 3건의 임포트 HTML 구조 보고 결정)

### 4.3 ai-client.ts 분기

**위치**: `src/lib/seo/ai-client.ts`

**변경**: description 생성 mode 분기
- `mode='preserve'`: v0.6 동작 (description input 미포함)
- `mode='replace'`: HTML 텍스트 추출 + spec 메타를 user prompt에 추가

**근거**: Day 27 학습 (Anthropic Vision URL source detour) 적용 — description input은 텍스트로만, 이미지는 URL source 그대로.

### 4.4 draft schema 임시 확장

**위치**: 마이그레이션 신규 (번호 자율, 032 권장)

**변경**: `seo_metadata_drafts` 테이블에 PoC 컬럼 2개 추가
- `description_mode VARCHAR(16) DEFAULT 'preserve' NOT NULL`
- `spec_metadata JSONB NULL`

**근거**: PoC 결과를 추적 가능한 데이터로 보존. v0.7 정식 명세 진입 시 컬럼 활용, 진입하지 않으면 후속 정리 마이그레이션으로 DROP.

**Claude Code 자율 결정 영역**:
- 마이그레이션 번호 (032 권장)
- DROP 마이그레이션은 PoC close 후 PM 결정에 따라

### 4.5 admin UI 사이드바이사이드 비교

**위치**: `src/app/admin/seo-drafts/[id]/page.tsx` + 신규 컴포넌트

**변경**: PoC 모드 진입 시 미리보기 화면을 2-column으로 분할
- 좌측: v0.6 정책 draft (description preserve)
- 우측: PoC 정책 draft (description replace + spec 메타)
- 운영자가 "어느 쪽 채택" 명시 선택 + 거절 선택지 추가

**근거**: 운영자 비교 검수 시간 측정 + 선호도 데이터 확보. timer는 운영자 수동 (5분 단위 round-up 기록 가능).

**Claude Code 자율 결정 영역**:
- 컴포넌트 분리 단위
- 운영자 선택 UX (radio vs button vs split-action)

### 4.6 backfill API PoC 분기

**위치**: `src/app/api/admin/seo-drafts/backfill/route.ts`

**변경**: Zod schema에 `poc_mode: boolean` 옵션 추가
- `poc_mode=true` 시: 각 상품에 대해 preserve + replace 양쪽 draft 생성 (큐 insert 2회)
- 기존 호출자는 미지정 시 false 기본값으로 회귀 0

**근거**: PoC 3건 트리거를 backfill API로 통합 → 별도 트리거 라우트 없이 처리. 운영자가 admin UI에서 PoC trigger 가능.

**Claude Code 자율 결정 영역**:
- poc_mode 트리거 UI 위치 (기존 backfill UI 옵션 vs 별도 buttons)

---

## 5. 단계별 진행

### 단계 1: PoC 명세 + 사전 점검 (Claude Code 세션 시작)

- `git status --short` + `git log --oneline -5` 표준 점검
- main HEAD가 Phase 3 머지 이후인지 확증
- 새 브랜치 (`feat/seo-d3-poc` 권장, 자율)
- spec v0.6 §11.4 환경 체크리스트 재확증 (`SEO_AI_MODE`, `SEO_AI_MONTHLY_USD_CAP`)

### 단계 2: 구현 (4~6h)

- 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 순서 권장 (의존성 순)
- 각 단계 단위 커밋
- mock 모드에서 1건 smoke test 후 다음 단계 진입

### 단계 3: 운영자 측 PoC 진입 게이트

- 운영자에게 PoC 진입 시점 합의 요청
- 샘플 3건 선정 (운영자가 admin UI에서 선택)
- production deploy → live 모드 전환 확증

### 단계 4: live 트리거 + 양 정책 draft 생성

- 운영자가 admin UI에서 poc_mode backfill trigger
- 큐 처리 6건 (3 상품 × 2 정책)
- worker 처리 ~3분
- 비용 실측 (Anthropic API usage 로그) — 예상 $0.05~0.10

### 단계 5: 운영자 비교 검수 (30~60m)

- 운영자가 admin UI 사이드바이사이드 화면에서 3건 비교
- 각 건마다 명시 선택 + 검수 시간 timer 기록
- 자유 코멘트 (선택 이유, 거절 이유)

### 단계 6: PM 결과 분석 (30m)

- 4가지 기준 측정 결과 정리
- 결과 매트릭스 기반 결정 (다음 §7)
- v0.7 진입 / 부분 채택 / close 중 결정

### 단계 7: 후속 처리

- v0.7 진입 결정 시: spec v0.7 작성 + 봄 41건 SEASONAL-BACKFILL-PLAN 정책 갱신
- close 결정 시: 마이그레이션 032 DROP + PoC 컬럼 정리 + v0.6 정책 유지
- 부분 채택 시: PoC v0.2 명세 또는 카테고리별 분기 정책 작성

---

## 6. 측정 지표 (PoC 완료 보고서 필수 항목)

```
[운영자 선호도]
- 상품 1: preserve / replace / 둘 다 거절
- 상품 2: ...
- 상품 3: ...
- 선호도 합계: replace 선택 N건 / 3건

[비용]
- preserve 평균 토큰: input X, output Y, $Z/건
- replace 평균 토큰: input X', output Y', $Z'/건
- 증가율: (Z' - Z) / Z × 100%

[검수 시간]
- preserve 검수 평균 시간: N초/건
- replace 검수 평균 시간: M초/건
- 증가율: (M - N) / N × 100%

[spec 정보 손실]
- 임포트 HTML 추출 spec 건수: A
- replace draft에 보존된 spec 건수: B
- 손실 건수: A - B

[자유 코멘트]
- 운영자 선택 이유 (각 건)
- PoC 정책 개선 제안 (있다면)
```

---

## 7. 결과 옵션 매트릭스

| 기준 통과 수 | 결정 | 후속 액션 |
|---|---|---|
| **4/4** | ✅ v0.7 정식 진입 | spec v0.7 작성 → SEASONAL-BACKFILL-PLAN 정책 갱신 |
| **3/4 (비용 미달)** | 🟡 부분 채택 | prompt 토큰 절감 후 PoC v0.2 또는 v0.6 유지 + 시즌별 분기 |
| **3/4 (검수 시간 미달)** | 🟡 부분 채택 | 검수 UI 효율화 후 PoC v0.2 또는 v0.6 유지 |
| **3/4 (spec 손실 발생)** | 🟡 부분 채택 | description-parser 휴리스틱 강화 후 PoC v0.2 |
| **2/4 또는 운영자 선호도 미달** | ❌ close | 마이그레이션 032 DROP + v0.6 유지 + D3 학습 등록 |
| **1/4 이하** | ❌ close | 위와 동일 + Phase 4 prompt v1.1 튜닝에서 description 품질 재시도 |

---

## 8. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| spec 추출 휴리스틱 정확도 낮음 | 중 | PoC 3건의 실측 HTML 보고 휴리스틱 조정. 임계 미달 시 PoC v0.2로 분리 |
| AI가 spec 정보를 description 본문에 묶어 분리 어려움 | 중 | prompt에 "spec은 별도 필드, description에는 자연어 본문만" 명시 |
| 비용 토큰 증가 +100% 초과 | 중 | description 길이 target 200~400자 강제, 8월 SEASONAL-BACKFILL-PLAN 비용 견적 영향 |
| 운영자 90% baseline에 영향 (PoC 결과 안 좋아도 운영자 신뢰 손실) | 저 | PoC는 비교 검수라 v0.6 정책 draft도 함께 노출. baseline 영향 0 |
| poc_mode backfill이 일반 backfill과 혼동 | 저 | admin UI에서 명시 라벨 분리, Zod schema validation |
| PoC 마이그레이션 032 미정리로 schema 잔재 | 저 | close 결정 시 후속 DROP 마이그레이션 명시 |
| PoC 진행 중 SEASONAL-BACKFILL-PLAN 트리거 시점 충돌 | 저 | PoC는 즉시 진입 또는 8월 진입 직전 둘 다 가능 — PM 결정 영역 |

---

## 9. 의존성

### 선행
- Phase 3 완료 ✅
- v0.6 정책 90% 승인 baseline 확보 ✅
- `seo_metadata_drafts` 운영 상태 (pending_review 0건 유지 권장)

### 외부
- Anthropic API 비용 폭주 0건 (PoC 6건 × ~$0.015 = $0.10 예상)
- 운영자 비교 검수 협업 합의 (30~60m)

### Non-Goals (재명시)
- 봄 41건 일괄 적용 결정 차단
- Phase 4 prompt v1.1 튜닝 통합
- SEASONAL-BACKFILL-PLAN 진입 일정 변경

---

## 10. 트리거 시점 — PM 결정 영역

### 옵션 가1: 즉시 진입 (Day 30 이후)

- Phase 3 안정화 완료 직후
- 8월 SEASONAL-BACKFILL-PLAN 진입 전 4개월 여유
- 결과에 따라 8월 backfill 정책 사전 결정 가능
- Risk: PoC 결과를 4개월간 기억 유지해야 함

### 옵션 가2: 8월 SEASONAL-BACKFILL-PLAN 진입 직전 합산

- SEASONAL-BACKFILL-PLAN 진입 시점에 PoC 3건을 1차로 실행
- PoC 통과 시: 잔여 30건 + 여름 신규 입고분에 새 정책 즉시 적용
- PoC 통과 실패 시: 잔여 30건은 v0.6 정책 그대로 진행
- 운영자 검수 분산 부담 0 (어차피 8월 시즌 진입 시 일괄 검수)
- Risk: 8월 일정 압박 (PoC 결과 분석 + v0.7 명세 + SEASONAL-BACKFILL-PLAN 실행 동시)

### 옵션 가3: 보류 (PoC 자체 close)

- v0.6 baseline 90% 승인률로 충분히 운영 가능
- D3는 SEO 이상론, 실제 ROI 불명확
- 8월 SEASONAL-BACKFILL-PLAN을 v0.6 정책 그대로 진행
- Risk: GSC 색인 보류 패턴이 봄 41건 + 잔여 30건에서 누적될 가능성

### PM 권장: **옵션 가2 (8월 합산)**

근거:
- Phase 3 완료 직후 PoC를 별도로 진행하면 운영자 검수가 2회 분산 (Phase 3 1차 검수 → PoC 검수 → SEASONAL backfill 검수)
- 8월 시즌 진입 시점에 1차 PoC + 잔여 backfill을 한 묶음으로 처리하면 운영자 검수 1회로 통합
- 4개월간 메모리 유지는 본 명세 + SEASONAL-BACKFILL-PLAN P2 백로그에 cross-reference로 보존하면 충분
- PoC가 통과 못해도 SEASONAL-BACKFILL-PLAN은 v0.6 정책으로 진행 가능 → blocking 없음

---

## 11. Stakeholder Action

- **PM**: 본 PoC 명세 v0.1 승인 + 트리거 시점 결정 (가1/가2/가3)
- **Dev (Claude Code)**:
  - 트리거 시점 도래 시 §4 구현 영역 진입 (4~6h)
  - 본 명세 §5 단계별 진행
  - 단계 6 PM 분석 진입 전 §6 측정 지표 모두 측정
- **운영자 (juji 배우자)**:
  - PoC 샘플 3건 선정 (시즌 무관 카테고리 우선)
  - 단계 5 비교 검수 30~60분 협업
  - 단계 5 자유 코멘트 작성
- **SEO**: PoC 결과 분석 시 SEO 관점 corollary (예: "spec 메타가 검색 결과 snippet에 어떻게 노출되는가") 추가 의견 제시

---

## 12. v0.1 → v0.2 후보 변경

- PoC 부분 채택 결정 시 정책 조정 사항
- 카테고리별 정책 분기 (의류 vs 가방/악세서리)
- spec-parser 휴리스틱 보강
- prompt 본문 변경

---

## 13. 명세 cross-reference

- 본 명세는 **spec-48-1-ai-product-seo-v0_6.md §14 "v0.6 → v0.7 후보 변경"** 항목 중 "description 발췌 1500자 → 800자 단축 효과 측정" 과 일부 겹침. PoC 단계 6 분석 시 본 토픽 함께 측정 가능 (자율 결정)
- 본 명세는 **SEASONAL-BACKFILL-PLAN P2 백로그**와 cross-reference 권장. 트리거 시점 결정에 따라 의존 관계 변동
- 본 명세 결과는 **Phase 4 prompt v1.1 명세 (P2, 운영 데이터 100건+ 누적 후 또는 시즌 진입 후)** 의 입력 데이터로도 활용 가능

---

**v0.1 작성 완료. PM 결정 항목 2건:**

1. PoC 명세 v0.1 승인 여부
2. 트리거 시점 (옵션 가1 즉시 / 가2 8월 합산 권장 / 가3 보류)
