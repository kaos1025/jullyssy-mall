# #48-1 AI 상품 SEO 자동화 명세 (Spec v0.5 — Phase 1 결과 반영)

## 0. Meta
- **작성일**: 2026-05-20 (Day 28)
- **버전 이력**:
  - v0.1 (2026-05-14): 초안
  - v0.2 (2026-05-14): 5건 결정 반영 (slug 제외, multimodal 채택, 수동 only, 소급 yes, prompt version)
  - v0.3 (2026-05-14): 이미지 처리 범위 축소 (5장 → 3장 multimodal + 나머지 패턴/빈 alt)
  - v0.4 (2026-05-19): Phase 0 PoC 결과 반영 minor 정정 6건
  - **v0.5 (2026-05-20)**: Phase 1 결과 반영 — image-processor 폐기 + URL source 정착 + user prompt 명세 + 비용 재계산 + vault 운영 매뉴얼
- **상태**: Phase 2 진입 가능
- **우선순위**: P1
- **선행 의존성**: Phase 1 ✅ (Day 27 PR #23 squash → main `a756379`)
- **예상 작업량 (잔여)**: Phase 2 ~6h + Phase 3 ~6h

### v0.5 핵심 변경 (Phase 1 결과 반영)

| 항목 | v0.4 | v0.5 | 근거 |
|---|---|---|---|
| Architecture 이미지 처리 | @jsquash/jpeg + resize → base64 inline | **Anthropic `source.type="url"` URL referencing** | Phase 1 B-2 P0 트리거: @jsquash Edge runtime 실패 → PM 옵션 1.5 URL source detour 적중 |
| `lib/seo/image-processor.ts` | Phase 1 본문 구현 | **폐기** (Track A-2 산출물 없음, ai-client.ts 내부에서 URL 전달) | URL referencing으로 fetch/resize/encode 모두 Anthropic 측 위임 |
| 입력 텍스트 토큰 가정 | 800 | **1953 (실측)** | Phase 1 1 live 검증 결과 (+144%, user prompt 명세 누락이 원인) |
| 비용/상품 (3장) | ~$0.0088 (≈ 12원) | **~$0.0095 (≈ 13원)** | 텍스트 +144% / 이미지 토큰 동일 / +8% 누적 |
| $20 캡 처리 가능 건수 | ~3000건 | **~2100건** | 동상 |
| 외부 fetch 책임 | Edge Function 측 | **Anthropic 측** | URL referencing 패턴 |
| user prompt 구조 명세 | (누락) | **§3 신규 추가** | Phase 1 학습 (3) 외부 AI spec 작성 시 system+user+tool 모두 토큰 견적 의무 |
| vault.secrets 운영 매뉴얼 | (없음) | **§11 추가** | Phase 2 진입 시 신규 환경 setup |
| Edge runtime 호환성 | 미검증 | **Anthropic URL detour로 우회** | Phase 1 인프라 변경 0 |

### v0.5에서 그대로 유지 (재명시 불필요)
- description NULL fallback (v0.4 §FR-2 D, §3 description-parser 그대로)
- 메인 갤러리 상위 3장 multimodal + 4번째+ 규칙 패턴 alt + description 임베디드 빈 alt 정책
- 운영자 승인 게이트 (수동 only)
- 모델 `claude-haiku-4-5-20251001` + tool use structured output
- prompt v1.0 system prompt
- `SEO_AI_MODE` mock/live 플래그 (NODE_ENV/VERCEL_ENV 분기 금지)

---

## 1. 배경 & 목적

### Context
- 쥴리씨 상품당 평균: 메인 갤러리 5~10장 + 상세설명 임베디드 수십 장 (Phase 0 실측 평균 **8.3장/상품**, description 임베디드 img **40~99장**)
- 모든 이미지에 AI multimodal 적용은 비용 폭증 + 가치 낮음
- SEO/접근성 측면에서 **메인 갤러리 상위 이미지**가 가장 가치 높음

### Goal
1. **메인 갤러리 상위 3장에 multimodal AI alt text** + 메타데이터 생성
2. **나머지 메인 이미지(4~10번)는 규칙 패턴 alt** 자동 삽입
3. **상세설명 임베디드 이미지는 빈 alt** 일괄 처리 (decorative)
4. 운영자 승인 게이트 통한 품질 검증

### Non-Goals (v0.4 동일)
- 상품 slug 자동 생성 → #48-2 ✅ DONE (Day 20 PR #15)
- description 본문 자동 생성
- 임베디드 이미지에 의미있는 alt text (decorative 처리)
- 카테고리 자동 분류
- 운영자 이미지 선택 UI
- Multi-language

---

## 2. 기능 요구사항 (v0.4 동일)

### FR-1: AI 생성 대상 필드

| 필드 | 타입 | 길이 제한 | 비고 |
|---|---|---|---|
| `meta_title` | string | ~60자 | Google 검색 표시 |
| `meta_description` | string | ~155자 | 검색 스니펫 |
| `search_tags` | string[] | 5~10개 | 롱테일 키워드 |
| `image_alt_texts` | object[] | **정확히 3개** (이미지 수 < 3 시 그 수) | 메인 갤러리 상위 3장의 alt (multimodal URL) |

### FR-2: 이미지 처리 정책 (v0.4 동일 + 한 가지 갱신)

**A. 메인 갤러리 (`product_images` 테이블)**:
- 상위 3장 (`sort_order asc`, 없으면 `created_at asc`): **multimodal AI alt text (URL source 전달)**
- 4번째 이후: **규칙 패턴 alt** 자동 삽입 (형식: `"{상품명} 상세컷 {n-3}"`)

**B. 상세설명 임베디드 이미지 (`products.description` HTML 내 `<img>`)**:
- 모든 `<img>` 태그에 `alt=""` 일괄 삽입 (이미 alt 있으면 유지)
- description HTML 파싱은 별도 유틸 (`lib/seo/description-parser.ts`, Phase 1 산출, **Vercel Node runtime 직접 import**)

**C. 메인 이미지가 3장 미만인 경우**: v0.4 동일.

**D. description NULL 처리 (v0.4 명시 그대로)**:
- ACTIVE 41건 중 12건 NULL
- `ensureImgAlts(null) → null` no-op
- meta_title/meta_description은 정상 생성

**🆕 v0.5 명세 갱신 — 이미지 fetch/리사이즈 책임 이동**:
- v0.4: Edge Function이 fetch + resize(longest-edge 1568) + jpeg encode + base64
- **v0.5: Anthropic API가 URL fetch + 분석** (`source: { type: "url", url: "https://shop-phinf.pstatic.net/..." }`)
- Edge Function 측 책임: 이미지 URL만 추출하여 ai-client에 전달
- Anthropic 측 토큰 산출: Phase 1 실측 이미지 토큰 ~1832/장 유지 (URL referencing에서도 동일 — Anthropic 측 1568² 환산 동일 가정, ±20% 신뢰)

### FR-3 ~ FR-5: v0.4 동일.

---

## 3. 기술 설계

### Architecture (v0.5 갱신)

```
[네이버 임포트 API] 
   ↓ (DB insert)
[products + product_images 테이블]
   ↓ (임포트 API에서 명시적 호출)
[seo_generation_queue] (pending)
   ↓ (Edge Function + cron, 1분 주기, batch=10)
   ↓ ┌─ product_images 상위 3장 URL 조회 (sort_order asc, src 컬럼만)
   ↓ └─ description HTML 파싱 (Phase 2 어드민 승인 시점에 처리)
[Anthropic API 호출 (Claude Haiku 4.5 — multimodal URL source, 3장)]
   ↓ tool use structured output
[seo_metadata_drafts] (pending_review)
   ↓ (운영자 승인, Phase 2)
   ↓ ┌─ products: meta_title/description/search_tags 업데이트
   ↓ ├─ product_images: 상위 3장 alt_text 업데이트 (AI)
   ↓ ├─ product_images: 4번째+ alt_text 업데이트 (규칙 패턴)
   ↓ └─ products.description: <img alt="" /> 일괄 처리 (ensureImgAlts, Vercel Node)
```

### v0.5 핵심 변경: Anthropic URL Source Detour

**Phase 1 B-2 P0 트리거 배경**:
- v0.4 §3 fetchAndResize 골격은 `@jsquash/jpeg + resize`를 Supabase Edge runtime에서 호출하는 구조
- Deno 환경에서는 검증 OK였으나, **production Edge runtime에서 WASM CPU/memory cap에 부딪힘** (Phase 1 Track B-2 실측)
- PM 옵션 1.5: Anthropic Vision API의 `source.type="url"` 패턴으로 detour
  - Anthropic이 직접 URL fetch + 토큰 최적화 처리
  - Edge Function은 URL만 전달, 이미지 처리 0
- 결과: 인프라 변경 0 + 라이브러리 교체 0 + Phase 1 통과 (검증 2 live PASS)

**v0.5 정착**:
- `lib/seo/image-processor.ts` **폐기** (Phase 1 본문 구현 산출물 없음)
- `lib/seo/ai-client.ts` 내부에서 URL 그대로 Anthropic 메시지 블록 구성:

```typescript
// ai-client.ts 내부 (Phase 1 적용 패턴 유지)
const imageBlocks = images.slice(0, 3).map(img => ({
  type: "image" as const,
  source: { type: "url" as const, url: img.src }
}));

await anthropic.messages.create({
  model: "claude-haiku-4-5-20251001",
  messages: [
    { role: "user", content: [...imageBlocks, { type: "text", text: userPrompt }] }
  ],
  tools: [seoMetadataTool],
  tool_choice: { type: "tool", name: "generate_seo_metadata" }
});
```

**제약**:
- 이미지 URL은 공개 접근 가능해야 함 (네이버 pstatic 99.5% + Supabase Storage public 버킷 0.5%, Phase 0 검증)
- private 이미지(인증 필요) 발생 시 fallback 필요 → 현 단계 미발생, Phase 3 운영 데이터로 재검토

### 🆕 v0.5 추가: User Prompt 구조 명세

**배경**: Phase 1 실측 입력 텍스트 1953 토큰 (spec v0.4 800 가정 대비 +144%). 원인은 user prompt 구조가 spec에 명시되지 않아 Claude Code가 자율 구성한 결과. v0.5에서 정확 구조 명시.

**User Prompt 구조 (Phase 1 적용 패턴)**:

```
[multimodal blocks]
- image_block_1 (URL source, sort_order asc 1번)
- image_block_2 (URL source, sort_order asc 2번)
- image_block_3 (URL source, sort_order asc 3번)

[text block]
상품 정보:
- 상품명: {product.name}
- 카테고리: {category_hint}
- 가격: {price}원
- 상세설명 텍스트 발췌:
  {description-parser로 HTML stripped 텍스트, 최대 1500자}

요청:
위 3장의 이미지를 시각적으로 분석하고, 상품 정보와 결합하여
generate_seo_metadata 도구를 호출하세요.
```

**텍스트 토큰 견적 v0.5**:
- 상품 정보 메타 (상품명/카테고리/가격): ~150 토큰
- description 발췌 (HTML stripped, 최대 1500자): ~1500 토큰
- 요청 지시문: ~100 토큰
- 시스템 프롬프트 (§3 v1.0): ~200 토큰
- **합계: ~1950 토큰** (Phase 1 실측 1953 일치)

**±30% 신뢰 구간**: 1365 ~ 2540 토큰. 카테고리·description 길이 편차로 변동.

**최적화 후보 (Phase 3 검토)**:
- description 발췌 1500자 → 800자 단축 (-50% 텍스트 토큰)
- 자주 사용되는 카테고리 정보는 system prompt로 이동 (cache 효과)
- 현 단계는 품질 우선 → 단축 미적용

### 모델: Claude Haiku 4.5 (v0.4 동일)

### Structured Output (slug 제외, 이미지 3장 고정, v0.4 동일)

```typescript
const seoMetadataTool = {
  name: "generate_seo_metadata",
  description: "Generate SEO metadata for fashion product",
  input_schema: {
    type: "object",
    properties: {
      meta_title: { type: "string", maxLength: 60 },
      meta_description: { type: "string", maxLength: 155 },
      search_tags: { 
        type: "array", 
        items: { type: "string" }, 
        minItems: 5, 
        maxItems: 10 
      },
      image_alt_texts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            image_index: { type: "integer" },
            alt_text: { type: "string", maxLength: 100 }
          },
          required: ["image_index", "alt_text"]
        },
        maxItems: 3
      }
    },
    required: ["meta_title", "meta_description", "search_tags", "image_alt_texts"]
  }
};
```

### 프롬프트 v1.0 — System Prompt (v0.4 그대로, 명세상 유지)

```
당신은 쥴리씨(여성의류 자사몰)의 SEO 전문가입니다.
20~40대 여성 타겟, 데일리룩~하객룩 영역.

상품의 메인 갤러리 상위 3장 이미지와 텍스트 정보를 받아 SEO 메타데이터를 도구 호출로 출력:

- meta_title: 60자 이내, "{핵심키워드} {시즌} {핏/소재} | {용도}" 패턴
- meta_description: 155자 이내, 자연어 + "~해요" 톤
- search_tags: 5~10개 롱테일 키워드 (단답 X)
- image_alt_texts: 전달받은 3장 이미지를 시각적으로 분석하여 각각 alt text 생성
  - image_index: 0, 1, 2 (전달 순서)
  - 시각 정보(색상, 포즈, 디테일) + 상품 정보 결합
  - 예: "베이지 플로럴 미디 원피스 정면 착용샷"

규칙:
- 키워드 스터핑 금지 (Google Helpful Content)
- 과장 광고 금지 ("최고의", "유일한")
- 시즌 키워드 우선
- 카테고리 내 description 다양성 확보
- 외모/인종/나이 추정 금지 (alt text 접근성 가이드)
```

### DB 스키마 (v0.4 마이그레이션 026 그대로 유지)

v0.4 §3 DB 스키마 변경 없음. Phase 1 Track A-1로 production apply 완료.

### 핵심 유틸리티 (v0.5 갱신)

**`lib/seo/image-processor.ts`**: 🚫 **폐기** (URL detour로 불필요)

**`lib/seo/description-parser.ts`** (Phase 1 산출, **유지**):
- Phase 2 Vercel Node runtime에서 직접 import 사용 (Edge runtime 미경유)
- v0.4 §3 그대로:

```typescript
import { parse } from 'node-html-parser';

export function ensureImgAlts(html: string | null): string | null {
  if (!html) return html;
  const root = parse(html);
  root.querySelectorAll('img').forEach((img) => {
    if (!img.getAttribute('alt')) {
      img.setAttribute('alt', '');
    }
  });
  return root.toString();
}
```

**`lib/seo/main-image-alt.ts`** (Phase 1 산출, v0.4 그대로):
```typescript
export function buildPatternAlt(productName: string, indexFromFour: number): string {
  return `${productName} 상세컷 ${indexFromFour}`;
}
```

**`lib/seo/ai-client.ts`** (Phase 1 산출, v0.5에서 URL source 패턴 명세):
- v0.4 §3에 명시된 retry / Sentry tag / cost 기록 그대로
- 이미지 처리는 §3 위 코드 블록 (URL referencing)

### 승인 시 적용 로직 (v0.4 §3 그대로 유지)

Phase 2 Track C에서 본문 구현 (description-parser는 어드민 승인 라우트의 Vercel Node runtime에서 직접 import).

### Edge Function

`supabase/functions/seo-generate-worker/index.ts`:
- 1분 주기, batch 10건
- 1건당 처리 시간 ~5~10초 예상 (URL detour로 이미지 fetch/resize 단계 제거 — Phase 1 실측 ~7초)
- **Phase 1 통과 ✅** (URL detour로 Edge runtime 호환성 우회)

### API 라우트 (v0.4 동일)

```
POST   /api/admin/seo-drafts/[id]/approve
POST   /api/admin/seo-drafts/[id]/reject
PATCH  /api/admin/seo-drafts/[id]
POST   /api/admin/products/[id]/regenerate-seo
POST   /api/admin/seo-drafts/backfill
GET    /api/admin/seo-drafts
```

모두 `verifyAdmin` + `adminLimiter` (60/60s). Phase 2에서 구현.

---

## 4. 비용 & 성능 예산 (v0.5 재계산)

### 단가 (Claude Haiku 4.5)
- 입력 텍스트: $1.00 / M tokens
- 입력 이미지 (URL referencing): ~1832 tokens/장 (Phase 0 환산 유지, ±20%)
- 출력: $5.00 / M tokens
- Batch API: 50% 할인 (Phase 4 검토)

### 상품당 평균 (이미지 3장 가정)

| 항목 | v0.4 | v0.5 | 변화 |
|---|---|---|---|
| 입력 텍스트 | 800 토큰 / $0.0008 | **1953 토큰 / $0.00195** | +144% |
| 입력 이미지 (3장) | 1832 × 3 / $0.0055 | 1832 × 3 / $0.0055 | 0 |
| 출력 | 500 토큰 / $0.0025 | 500 토큰 / $0.0025 | 0 |
| **합계** | **~$0.0088 (≈ 12원)** | **~$0.0095 (≈ 13원)** | **+8%** |

Phase 1 실측 1 live 검증: **$0.0095/상품** (위 견적과 일치).

### 예산

| 항목 | v0.4 | v0.5 |
|---|---|---|
| 초기 임포트 1000개 | ~12,000원 | **~13,000원** |
| 월 100개 신규 | ~1,200원 | **~1,300원** |
| **$20 캡 처리 가능** | **~3,000건** | **~2,100건** |
| 월 캡 권장 | $20 | $20 (유지) |

### 성능
- batch 10건/분 = 시간당 600건
- 1000개 임포트 시 ~1.7시간 내 draft 완료
- 1건당 ~5~10초 (URL detour로 v0.4 가정 10~15초 대비 단축)

---

## 5. 단계별 구현 계획

### Phase 0: 사전 점검 ✅ DONE (Day 26)
- v0.4 §5 그대로.

### Phase 1: MVP + Multimodal ✅ DONE (Day 27, PR #23 → main `a756379`)
- 마이그레이션 026 production apply ✅
- `lib/seo/description-parser.ts` 본문 구현 ✅
- `lib/seo/main-image-alt.ts` ✅
- `lib/seo/ai-client.ts` (multimodal URL source) ✅
- `lib/seo/prompts.ts` v1.0 ✅
- `supabase/functions/seo-generate-worker/` Edge Function (batch 10) ✅
- 네이버 임포트 hook ✅
- mock 모드 ✅
- 🚫 `lib/seo/image-processor.ts` — **폐기 (URL detour로 불필요)**
- PoC 산출물 cleanup ✅
- 검증 draft 2건 (mock+live) 보존 → **Phase 2 UI 테스트 데이터로 사용**

### Phase 2: 어드민 UI (Day 28~, ~6h)
- [ ] `/admin/seo-drafts` 페이지 + GET API
- [ ] 미리보기/편집 컴포넌트 (3장 alt + 규칙 패턴 미리보기)
- [ ] 인라인 편집 (meta_title/description/tags + 3장 alt_text)
- [ ] PATCH `/api/admin/seo-drafts/[id]` (편집 저장)
- [ ] POST `/api/admin/seo-drafts/[id]/approve` (description-parser Vercel Node 직접 import)
- [ ] POST `/api/admin/seo-drafts/[id]/reject`
- [ ] POST `/api/admin/products/[id]/regenerate-seo`
- [ ] verifyAdmin + adminLimiter (모두)
- [ ] 검증 draft 2건 활용한 첫 승인 테스트
- **Phase 2 진입 명세는 별도 문서 (`phase2-entry-prompt.md`)**

### Phase 3: 운영 & 소급 (Day 29~, ~6h)
- v0.4 §5 그대로:
  - Sentry tag (model, prompt_version, image_count)
  - 비용 모니터링 (admin dashboard 누적 USD + 월 캡 $20 alert)
  - `/admin/seo-drafts/backfill`
  - 기존 상품 소급 batch (ACTIVE 41건 × $0.0095 ≈ $0.39)
  - 첫 100건 운영자 검토 → 프롬프트 v1.1 튜닝

### Phase 4 (P2, 추후): Gemini Flash A/B
- 운영 데이터 100건 승인률 확보 후

---

## 6. 검증 기준 (v0.4 그대로 + v0.5 비용)

- 기능 검증: v0.4 §6 동일
- 품질 검증: v0.4 §6 동일
- **비용 검증 (v0.5 기준)**:
  - 상품당 평균 < **$0.011** (v0.4 $0.010 → 정정, 10% 마진)
  - Phase 3 소급 batch ACTIVE 41건 < **$0.50** (v0.4 $0.36 → 정정)
  - 월 누적 < $20

---

## 7. Risks & Mitigation (v0.5 갱신 부분만)

| Risk | Impact | Mitigation | Phase 1 검증 |
|---|---|---|---|
| Edge Function timeout | 저 ⬇⬇ | URL detour로 1건 ~7초 (이미지 처리 0) | ✅ Phase 1 통과 |
| Edge runtime 라이브러리 호환성 | 해소 | URL detour로 @jsquash 의존 폐기 | ✅ 인프라 변경 0 |
| Anthropic URL fetch 실패 (네이버 pstatic 차단/down) | 중 | retry 3회 + Sentry, fallback (텍스트 only) | 🟡 Phase 3 운영 데이터로 발생률 측정 |
| 텍스트 토큰 예산 초과 | 저 | description 1500자 단축 옵션 (Phase 3 검토) | ✅ Phase 1 실측 1953 spec 반영 |
| **🆕 user prompt 명세 외 자율 수정으로 토큰 재증가** | 중 | spec v0.5 §3 명세 고정 + 변경 시 v0.6 명세 갱신 의무 | - |
| **🆕 vault.secrets seo_worker_auth 미등록** | 중 | §11 운영 매뉴얼 명시 + Phase 2 진입 전 확증 step | - |
| **🆕 description-parser Vercel Node runtime import 경로 잘못** | 저 | Phase 2 Track C에서 직접 import OK 확정 (Edge runtime 미경유) | - |

다른 항목은 v0.4 §7 그대로.

---

## 8. 의존성

### 선행
- v0.4 §8 + Phase 1 ✅ (Day 27 PR #23)

### 병렬
- v0.4 §8 동일

### 외부
- Anthropic API 키 ✅ (URL detour로 vision 권한 활성 확증)
- Supabase Edge Function cron ✅
- HTML 파서 ✅ (`node-html-parser@7.0.1`, Phase 2 Vercel Node에서 직접 import)
- **🆕 Vercel vault.secrets** (Phase 2 진입 시 setup, §11 참조)

---

## 9. Stakeholder Action

- **PM**: v0.5 확정 → Phase 2 진입 명세 작성 (별도 문서) → Claude Code 진입
- **Dev (Claude Code)**:
  - (Phase 1) ✅ DONE
  - (Phase 2) Phase 2 진입 명세 기반 ~6h 작업
- **SEO**: 프롬프트 v1.0 카테고리별 변주 (Phase 3 첫 100건 검토 후 v1.1 튜닝)
- **운영자 (juji 배우자)**:
  - Phase 2 완료 후 어드민 승인 UI 검토
  - backfill 실행 시점 합의 (Phase 3)

---

## 10. 트리거 시점

```
[완료] Day 26 Phase 0 PoC
[완료] Day 27 Phase 1 (PR #23 → main a756379)
  ↓
[현재] Day 28 spec v0.5 + Phase 2 진입 명세 작성
  ↓
[다음] Phase 2 (~6h) Claude Code 새 세션
  ↓
[Phase 3] 운영 & 소급 (~6h)
  ↓
[Phase 4, P2] Gemini A/B
```

---

## 11. 🆕 운영 매뉴얼 (Phase 2 신규 환경 setup)

### 11.1 vault.secrets 등록 절차 (`seo_worker_auth`)

**배경**: Phase 2부터 Edge Function이 production API를 호출할 수 있도록 worker 측 인증 토큰 필요. Vercel env가 아닌 Supabase vault.secrets에 등록 (Edge Function 측 보안 경로).

**등록 절차** (운영자 직접 수행 또는 Claude Code 자율):
1. Supabase Dashboard → Project Settings → Vault
2. New Secret 생성:
   - Name: `seo_worker_auth`
   - Value: 32바이트 hex 랜덤 (예: `openssl rand -hex 32` 결과)
3. Edge Function이 `Deno.env.get('SEO_WORKER_AUTH')` 또는 vault read API로 사용
4. Phase 2 어드민 측 API는 동일 토큰을 `SEO_WORKER_AUTH` Vercel env에 등록 후 헤더 비교
   - `Authorization: Bearer ${SEO_WORKER_AUTH}` (timingSafeEqual 비교)

**검증 포인트**:
- vault.secrets에 `seo_worker_auth` 존재 확증
- Vercel env에 동일 값 등록 (Production만, Preview/Development 미등록)
- 첫 worker → API 호출 시 200 OK 확증

### 11.2 `SEO_AI_MODE` env 등록 절차

**배경**: Phase 1까지는 `SEO_AI_MODE=mock` 기본 운영 (검증 외 0 호출). Phase 2 완료 + 운영자 합의 후 `live` 전환.

**등록 절차**:
1. Vercel Dashboard → Project Settings → Environment Variables
2. New variable:
   - Key: `SEO_AI_MODE`
   - Value: `mock` (Phase 2 진입 시점 기본값)
   - Environments: Production / Preview / Development 모두
3. Phase 3 운영자 합의 후 Production만 `live`로 변경

**전환 시 검증**:
- Production env `SEO_AI_MODE=live`로 변경 후 Vercel 재배포
- 다음 임포트 1건 → Sentry tag `seo_ai_mode=live` 확증
- 첫 24h 비용 누적 Sentry breadcrumb 또는 admin dashboard에서 확증

### 11.3 Phase 2 진입 전 checklist

- [ ] vault.secrets `seo_worker_auth` 등록 + Vercel env 동일 값 등록
- [ ] `SEO_AI_MODE=mock` Production env 등록 확증 (Phase 1에서 이미 등록 가정 — 미등록 시 Phase 2 첫 step에서 보강)
- [ ] Phase 1 검증 draft 2건 (mock + live) DB 잔존 확증 (Phase 2 UI 테스트 데이터)

---

## 12. Phase 0 산출물 인덱스 (v0.5 갱신)

| 항목 | 경로 | 상태 |
|---|---|---|
| Phase 0 보고서 | `docs/seo/phase0-report-2026-05-19.md` | 보존 |
| Phase 1 보고서 | `docs/seo/phase1-report-2026-05-20.md` (Day 27 산출 가정) | 보존 |
| 마이그레이션 026 | `supabase/migrations/026_seo_metadata.sql` | ✅ apply 완료 |
| Edge Function PoC | `supabase/functions/seo-poc/index.ts` | ✅ Phase 1 cleanup 완료 (Track D) |
| 정식 worker | `supabase/functions/seo-generate-worker/index.ts` | ✅ Phase 1 산출 |
| description-parser | `lib/seo/description-parser.ts` | ✅ Phase 1 산출 |
| main-image-alt | `lib/seo/main-image-alt.ts` | ✅ Phase 1 산출 |
| ai-client | `lib/seo/ai-client.ts` | ✅ Phase 1 산출 (URL source 패턴) |
| prompts | `lib/seo/prompts.ts` v1.0 | ✅ Phase 1 산출 |
| 🚫 image-processor | (없음) | **폐기 — Phase 1 URL detour로 제거** |
| 검증 draft 2건 (mock+live) | `seo_metadata_drafts` table | 보존 → Phase 2 UI 테스트 데이터 |

---

## 13. v0.4 → v0.5 변경 요약 (1줄 요약)

| 변경 | 1줄 |
|---|---|
| §3 Architecture | @jsquash Edge 호환성 실패 → Anthropic `source.type="url"` URL referencing detour로 우회. image-processor.ts 폐기. |
| §3 User Prompt | Phase 1 실측 1953 토큰 (v0.4 800 → +144%). User prompt 구조 명세 §3 신규 추가. |
| §4 비용 | $0.0088 → $0.0095 (+8%). $20 캡 3000건 → 2100건. |
| §11 운영 매뉴얼 | vault.secrets `seo_worker_auth` + `SEO_AI_MODE` 등록 절차 신규 추가. |
| description NULL | v0.4에서 이미 반영 — v0.5 재명시 불필요. |

---

## 14. v0.5 → v0.6 후보 변경 (Phase 2~3 진입 후 검토)

- 운영자 첫 100건 검토 결과 → 프롬프트 v1.1 튜닝
- description 발췌 1500자 → 800자 단축 효과 측정 (Phase 3, -50% 텍스트 토큰)
- Anthropic URL fetch 실패율 측정 (네이버 pstatic 차단/down 발생 시 fallback 정책)
- Gemini Flash A/B 결과 (Phase 4)
- 시스템 프롬프트 카테고리별 변주 (시즌·핏·소재 키워드)

---

**v0.5 작성 완료. Phase 2 진입 명세는 별도 문서 (`phase2-entry-prompt.md`)로 동시 산출.**
