---
name: commit
description: 코드 변경사항을 검증하고 커밋/푸시합니다. "커밋", "커밋해줘", "푸시", "commit", "push", "변경사항 저장" 등의 요청 시 자동 실행.
---

# 스마트 커밋 & 푸시

## 실행 절차

### Step 1: Pre-commit 5단계 검증

아래를 순서대로 실행. **하나라도 실패하면 커밋하지 말고** 에러를 수정하라.

```bash
# 1. TypeScript 타입 체크 — 0 errors 필수
npx tsc --noEmit

# 2. ESLint — 0 errors 필수
npx next lint

# 3. 시크릿 하드코딩 검사
grep -rn "sk_live\|sk_test\|service_role\|supabase_service" src/lib/ src/app/api/ --include="*.ts" --include="*.tsx" || echo "✅ No hardcoded secrets"

# 4. console.log 잔존 검사
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test." || echo "✅ No stray console.log"

# 5. .env 파일 staged 여부
git diff --staged --name-only | grep -E "^\.env" && echo "🚨 .env staged! 즉시 중단!" || echo "✅ No .env staged"
```

### Step 2: 변경사항 분석

```bash
git diff --staged --name-only
git diff --name-only
git status --short
```

**1 commit = 1 intent 원칙:**
- 변경사항에 feature + refactor + style이 섞여있으면 **분리 커밋을 제안**하라.
- 예: "새 컴포넌트 추가"와 "기존 코드 포맷팅"은 별도 커밋.

### Step 3: 커밋 메시지 생성

**형식:**

```
<type>(<scope>): <subject>
```

**규칙:**
- Subject: **50자 이내**, 마침표 없음
- 한국어로 작성
- scope 생략 가능 (여러 영역에 걸친 변경인 경우)

**type:**

| type | 용도 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat(product): 상품 상세 이미지 갤러리` |
| `fix` | 버그 수정 | `fix(cart): 수량 변경 시 가격 미반영` |
| `refactor` | 리팩토링 | `refactor(api): 주문 에러 처리 통일` |
| `style` | UI/스타일링 | `style(header): 모바일 네비 반응형 개선` |
| `chore` | 설정/의존성 | `chore: shadcn/ui 컴포넌트 추가` |
| `docs` | 문서 | `docs: CLAUDE.md 폴더 구조 업데이트` |
| `test` | 테스트 | `test(order): 주문 생성 API 테스트` |

**scope:**

| scope | 해당 경로 |
|-------|-----------|
| `product` | `src/app/(shop)/products/`, `src/components/product/` |
| `cart` | `src/hooks/use-cart.ts`, `src/app/(shop)/cart/` |
| `order` | `src/app/api/orders/`, `src/app/(shop)/checkout/` |
| `payment` | `src/app/api/payments/` |
| `auth` | `src/app/(auth)/`, `src/app/api/auth/` |
| `admin` | `src/app/admin/` |
| `review` | `src/app/api/reviews/`, `src/components/product/Review*.tsx` |
| `naver` | `src/app/api/naver/` |
| `ui` | `src/components/ui/`, `src/components/layout/` |
| `db` | `supabase/migrations/` |

### Step 4: 커밋 실행

```bash
git add -A
git commit -m "<생성된 메시지>"
```

### Step 5: 푸시 (사용자가 "푸시"도 요청한 경우만)

```bash
git branch --show-current
git push origin <현재-브랜치>
```

## 주의사항

- Pre-commit 5단계 중 하나라도 실패 → 커밋 금지
- 1 commit = 1 intent → 혼합 변경은 분리 제안
- Subject 50자 초과 → 줄여서 재생성
- `.env.local` staged → 즉시 중단 + 경고
