#!/bin/bash
# ==============================================
# 쥴리씨 자사몰 - Claude Code Skills 설치 스크립트
# ==============================================
# 사용법: jullyssy-mall 프로젝트 루트에서 실행
#   bash setup-skills.sh
# ==============================================

set -e

# 프로젝트 루트 확인
if [ ! -f "package.json" ] || [ ! -f "CLAUDE.md" ]; then
  echo "❌ 에러: jullyssy-mall 프로젝트 루트에서 실행해주세요."
  exit 1
fi

echo "🚀 Claude Code Skills 설치 시작..."

# .claude/skills 디렉토리 생성
mkdir -p .claude/skills/code-review
mkdir -p .claude/skills/commit
mkdir -p .claude/skills/test
mkdir -p .claude/skills/pr

echo "📁 디렉토리 생성 완료"

# --- code-review SKILL.md ---
cat > .claude/skills/code-review/SKILL.md << 'SKILL_EOF'
---
name: code-review
description: Next.js 14 + Supabase 여성의류 자사몰 코드 리뷰. "코드 리뷰", "리뷰해줘", "코드 검토", "review", "이거 괜찮아?" 등의 요청 시 자동 실행.
---

# 쥴리씨 자사몰 코드 리뷰

## 실행 절차

1. 변경된 파일 목록 확인: `git diff --name-only HEAD~1` 또는 `git diff --staged --name-only`
2. 각 파일을 아래 체크리스트 기준으로 검사
3. 결과를 정해진 출력 형식으로 보고

## 체크리스트

### 🚨 CRITICAL (반드시 수정)

- **보안**: Supabase service_role_key가 클라이언트 코드에 노출되지 않았는가?
- **보안**: API Route에서 인증 확인 없이 데이터 수정하는 곳이 없는가?
- **보안**: RLS 우회 가능한 쿼리가 없는가? (admin API는 예외)
- **결제**: 토스페이먼츠 금액 검증이 서버에서 수행되는가?
- **결제**: 주문 생성 시 스냅샷(상품명, 가격, 옵션)을 저장하는가?
- **타입 안전**: `as any`, `@ts-ignore`를 사용하지 않았는가?
- **환경변수**: API Key, Secret이 하드코딩되지 않았는가?

### ⚠️ MAJOR (권장 수정)

- **Supabase 클라이언트 분리**: 브라우저→`client.ts`, 서버컴포넌트→`server.ts`, 어드민→`admin.ts` 올바른 것을 사용하는가?
- **서버/클라이언트 분리**: `"use client"` 없이 useState, useEffect 등 훅을 사용하지 않았는가?
- **서버/클라이언트 분리**: 불필요하게 `"use client"`를 선언하지 않았는가?
- **에러 처리**: API Route에 try-catch가 있고 `{ error: string }` 형태로 응답하는가?
- **금액 처리**: 가격/금액이 int(원 단위)로 처리되는가? (소수점 금지)
- **성능**: 서버 컴포넌트에서 가능한 데이터를 fetch하고 클라이언트에 props로 전달하는가?
- **N+1 쿼리**: Supabase select에서 관계 데이터를 join으로 한 번에 가져오는가?

### 📝 MINOR (선택 개선)

- **네이밍**: 파일은 PascalCase(컴포넌트) 또는 kebab-case(라우트), import는 `@/` alias 사용
- **컴포넌트 크기**: 하나의 컴포넌트가 200줄을 넘지 않는가?
- **중복 코드**: 반복되는 패턴이 있으면 커스텀 훅이나 유틸로 추출 가능한가?
- **접근성**: img에 alt, button에 aria-label 등 기본 접근성이 충족되는가?
- **모바일 퍼스트**: Tailwind 클래스가 모바일 우선(기본값)으로 작성되었는가?

### 🛒 비즈니스 로직

- **재고**: 주문/결제 시 재고 차감 로직이 원자적(atomic)인가?
- **네이버 연동**: naver_product_no, naver_option_id 매핑이 유지되는가?
- **쿠폰/포인트**: 할인 금액 계산이 서버에서 검증되는가?
- **주문 상태**: OrderStatus 전이가 올바른가? (예: PENDING→PAID만 가능)

## 출력 형식

```
## 🔍 코드 리뷰 결과

### 🚨 Critical
- [파일:라인] 이슈 설명 → 수정 제안

### ⚠️ Major
- [파일:라인] 이슈 설명 → 수정 제안

### 📝 Minor
- [파일:라인] 이슈 설명

### ✅ 잘된 점
- 칭찬

### 📊 요약
| 등급 | 개수 |
|------|------|
| Critical | N |
| Major | N |
| Minor | N |
| **판정** | 통과 / 조건부 통과 / 재검토 필요 |
```

## 판정 기준

- Critical 1개 이상 → **재검토 필요**
- Major 3개 이상 → **조건부 통과**
- 그 외 → **통과**
SKILL_EOF

echo "✅ code-review 스킬 생성"

# --- commit SKILL.md ---
cat > .claude/skills/commit/SKILL.md << 'SKILL_EOF'
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
SKILL_EOF

echo "✅ commit 스킬 생성"

# --- test SKILL.md ---
cat > .claude/skills/test/SKILL.md << 'SKILL_EOF'
---
name: test
description: Next.js 14 자사몰 테스트 작성 및 실행. "테스트", "테스트 작성", "test", "테스트 돌려줘", "이거 테스트 해줘" 등의 요청 시 자동 실행.
---

# 쥴리씨 자사몰 테스트 자동화

## 테스트 환경 확인

먼저 테스트 도구가 설치되어 있는지 확인하라:

```bash
npx vitest --version 2>/dev/null || npx jest --version 2>/dev/null || echo "NO_TEST_RUNNER"
```

테스트 러너가 없으면 아래를 설치 제안:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

vitest 설정 파일이 없으면 생성:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

## 테스트 작성 규칙

### 파일 위치

테스트 파일은 소스 파일과 같은 디렉토리에 `.test.ts(x)` 확장자로 생성:

```
src/app/api/orders/route.ts
src/app/api/orders/route.test.ts     ← 여기

src/components/product/ProductCard.tsx
src/components/product/ProductCard.test.tsx  ← 여기

src/hooks/use-cart.ts
src/hooks/use-cart.test.ts           ← 여기
```

### 테스트 분류

| 종류 | 대상 | 우선순위 |
|------|------|----------|
| **API Route 테스트** | `src/app/api/**` | 🔴 최우선 |
| **비즈니스 로직 테스트** | `src/hooks/`, `src/lib/` | 🔴 최우선 |
| **컴포넌트 테스트** | `src/components/**` | 🟡 중요 |
| **페이지 테스트** | `src/app/**/(page).tsx` | 🟢 선택 |

### API Route 테스트 패턴

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}))

describe('POST /api/orders', () => {
  it('인증되지 않은 요청은 401을 반환한다', async () => {})
  it('재고 부족 시 400을 반환한다', async () => {})
  it('정상 주문 시 스냅샷이 저장된다', async () => {})
  it('금액은 정수(원 단위)로 저장된다', async () => {})
})
```

### Hook 테스트 패턴

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCartStore } from './use-cart'

describe('useCartStore', () => {
  beforeEach(() => { useCartStore.getState().clearCart() })
  it('상품을 추가하면 cart에 반영된다', () => {})
  it('같은 옵션의 상품을 추가하면 수량이 증가한다', () => {})
  it('총 금액이 정확히 계산된다', () => {})
})
```

## 테스트 실행

```bash
npx vitest run                                    # 전체
npx vitest run src/app/api/orders/route.test.ts   # 특정 파일
npx vitest                                        # watch
npx vitest run --coverage                         # 커버리지
```

## 주의사항

- Supabase는 항상 **모킹** (실제 DB 연결 금지)
- 토스페이먼츠 API 호출도 반드시 **모킹**
- 환경변수는 `vi.stubEnv()` 사용
- 금액 관련 테스트는 **경계값**(0원, 최대 금액, 할인 후 0원 이하) 반드시 포함
SKILL_EOF

echo "✅ test 스킬 생성"

# --- pr SKILL.md ---
cat > .claude/skills/pr/SKILL.md << 'SKILL_EOF'
---
name: pr
description: Pull Request를 생성합니다. "PR", "풀리퀘스트", "PR 만들어줘", "머지 요청", "pull request" 등의 요청 시 자동 실행.
---

# Pull Request 생성

## 실행 절차

### Step 1: 현재 상태 확인

```bash
git branch --show-current
git log main..HEAD --oneline
git diff main --name-only --stat
```

main 브랜치에서 직접 PR을 만들려고 하면 **중단**하고 피처 브랜치 생성을 제안하라.

### Step 2: 미커밋 변경사항 처리

```bash
git status --short
```

미커밋 변경사항이 있으면 **먼저 commit 스킬을 실행**하라.

### Step 3: 원격 푸시

```bash
BRANCH=$(git branch --show-current)
git push origin $BRANCH
```

### Step 4: PR 본문 생성

아래 템플릿에 따라 PR 본문을 작성하라:

```markdown
## 📋 작업 요약
## 🔄 변경 내역
### 추가 / 수정 / 삭제
## 📁 변경 파일
| 파일 | 변경 내용 |
|------|-----------|
## 🧪 테스트
- [ ] TypeScript 타입 체크 통과
- [ ] ESLint 통과
- [ ] 로컬 빌드 성공
- [ ] 주요 기능 수동 테스트 완료
## 🏷️ 카테고리
- [ ] 🆕 새 기능 / 🐛 버그 수정 / ♻️ 리팩토링 / 💄 스타일 / 🗃️ DB / ⚙️ 설정
## 📝 참고사항
```

### Step 5: PR 타이틀

Conventional Commits: `<type>(<scope>): <한국어 설명>`

### Step 6: PR 생성

```bash
gh pr create --title "<타이틀>" --body "<본문>" --base main --head $(git branch --show-current)
```

gh CLI가 없으면: `https://github.com/kaos1025/jullyssy-mall/compare/main...<브랜치명>`

## 주의사항

- DB 마이그레이션 포함 시 ⚠️ 경고 추가
- 결제 로직 변경 시 ⚠️ 경고 추가
- 환경변수 변경 시 ⚠️ Vercel 업데이트 필요 경고 추가
SKILL_EOF

echo "✅ pr 스킬 생성"

# settings.local.json 업데이트
cat > .claude/settings.local.json << 'JSON_EOF'
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npx shadcn@latest:*)",
      "Bash(npx tsc:*)",
      "Bash(npx next:*)",
      "Bash(npx vitest:*)",
      "Bash(npx eslint:*)",
      "Bash(git:*)",
      "Bash(gh pr:*)",
      "Bash(gh auth:*)"
    ]
  }
}
JSON_EOF

echo "✅ settings.local.json 업데이트"

echo ""
echo "=========================================="
echo "🎉 Claude Code Skills 설치 완료!"
echo "=========================================="
echo ""
echo "생성된 스킬:"
echo "  📋 .claude/skills/code-review/SKILL.md"
echo "  📦 .claude/skills/commit/SKILL.md"
echo "  🧪 .claude/skills/test/SKILL.md"
echo "  🔀 .claude/skills/pr/SKILL.md"
echo ""
echo "사용법 (Claude Code 터미널에서):"
echo '  > "코드 리뷰해줘"     → code-review 자동 실행'
echo '  > "커밋해줘"           → commit 자동 실행'
echo '  > "테스트 작성해줘"    → test 자동 실행'
echo '  > "PR 만들어줘"       → pr 자동 실행'
echo ""
echo "커밋하려면:"
echo "  git add -A && git commit -m 'chore: Claude Code Skills 세팅'"
echo "  git push origin main"
