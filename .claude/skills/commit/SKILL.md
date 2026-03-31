---
name: commit
description: 코드 변경사항을 검증하고 커밋/푸시합니다. "커밋", "커밋해줘", "푸시", "commit", "push", "변경사항 저장" 등의 요청 시 자동 실행.
---

# 스마트 커밋 & 푸시

## 실행 절차

### Step 1: Pre-commit 검증

아래 명령을 순서대로 실행하고, 하나라도 실패하면 **커밋하지 말고** 에러를 수정하라.

```bash
# 1. TypeScript 타입 체크
npx tsc --noEmit

# 2. ESLint 검사
npx next lint

# 3. 빌드 가능 여부 (선택 - 사용자가 "빠른 커밋" 요청 시 스킵 가능)
# npm run build
```

### Step 2: 변경사항 분석

```bash
# staged 파일 확인
git diff --staged --name-only

# staged 없으면 전체 변경사항 확인
git diff --name-only
git status --short
```

### Step 3: 커밋 메시지 생성

**Conventional Commits** 형식을 따르라:

```
<type>(<scope>): <한국어 설명>

- 변경 내용 1
- 변경 내용 2
```

**type 규칙:**

| type | 용도 | 예시 |
|------|------|------|
| `feat` | 새 기능 | `feat(product): 상품 상세 페이지 구현` |
| `fix` | 버그 수정 | `fix(cart): 수량 변경 시 가격 미반영 수정` |
| `refactor` | 리팩토링 | `refactor(api): 주문 API 에러 처리 통일` |
| `style` | UI/스타일링 | `style(header): 모바일 네비게이션 반응형 개선` |
| `chore` | 설정/의존성 | `chore: shadcn/ui 컴포넌트 추가` |
| `docs` | 문서 | `docs: CLAUDE.md 폴더 구조 업데이트` |
| `test` | 테스트 | `test(order): 주문 생성 API 테스트 추가` |

**scope 규칙 (이 프로젝트 전용):**

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
# 변경사항이 staged가 아니면 먼저 add
git add -A

# 커밋
git commit -m "<생성된 메시지>"
```

### Step 5: 푸시 (사용자가 "푸시"도 요청한 경우만)

```bash
# 현재 브랜치 확인
git branch --show-current

# 푸시
git push origin <현재-브랜치>
```

## 주의사항

- `.env.local` 파일이 staged에 포함되면 **즉시 중단**하고 경고
- `console.log`가 남아있으면 커밋 전 알림 (디버깅 코드 정리)
- 한 커밋에 관련 없는 변경이 섞여있으면 분리 커밋 제안
- 커밋 메시지는 반드시 **한국어**로 작성
