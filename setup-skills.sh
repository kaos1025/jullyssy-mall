#!/bin/bash
# ==============================================
# 쥴리씨 자사몰 — Claude Code Skills v2 설치 스크립트
# ==============================================
# v2 변경사항:
#   - Git Conventions 추가 (50자 제한, 1 commit = 1 intent)
#   - Pre-commit 5단계 검증 (시크릿 스캔, console.log 검사)
#   - Definition of Done 체크리스트
#   - review-cycle 스킬 신규 추가
#   - Slash Commands 참조 추가
# ==============================================
# 사용법: jullyssy-mall 프로젝트 루트에서 실행
#   bash setup-skills.sh
# ==============================================

set -e

if [ ! -f "package.json" ]; then
  echo "❌ 에러: jullyssy-mall 프로젝트 루트에서 실행해주세요."
  exit 1
fi

echo "🚀 Claude Code Skills v2 설치 시작..."

mkdir -p .claude/skills/{code-review,commit,test,pr,review-cycle}

# ─────────────────────────────────────────────
# CLAUDE.md 업데이트
# ─────────────────────────────────────────────
cat > CLAUDE.md << 'CLAUDE_EOF'
# 쥴리씨 - 여성의류 자사몰

## 프로젝트 개요
- 여성의류 자사몰 신규 개발 (네이버 스마트스토어 → 자사몰 확장)
- 1인 바이브코딩 개발, 1개월 내 런칭 목표
- 타겟: 20~40대 여성

## 기술 스택 (변경 불가)
- **프론트엔드**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **백엔드/DB**: Supabase (Auth + PostgreSQL + Storage)
- **비즈니스 로직**: Next.js API Routes (Route Handlers)
- **결제**: 토스페이먼츠
- **배포**: Vercel + Supabase Cloud
- **폰트**: Pretendard (한국어 최적화)

## 코딩 컨벤션
- 모든 코드는 TypeScript strict mode
- 컴포넌트: 함수형 + Arrow Function export
- 서버 컴포넌트 기본, 클라이언트 필요시에만 "use client"
- import 경로: @/ alias 사용 (src/ 기준)
- Supabase 클라이언트 3종 분리:
  - 브라우저(CSR): `@/lib/supabase/client`
  - 서버컴포넌트(SSR): `@/lib/supabase/server`
  - 서비스롤(어드민): `@/lib/supabase/admin`
- API Route에서 에러 응답: `{ error: string, code?: string }` 형태 통일
- 가격/금액은 항상 int (원 단위, 소수점 없음)

## 폴더 구조
```
src/
├── app/
│   ├── (auth)/          # 로그인/회원가입 (별도 레이아웃)
│   ├── (shop)/          # 고객 화면 (헤더+푸터 레이아웃)
│   ├── admin/           # 관리자 (별도 레이아웃, 미들웨어 가드)
│   └── api/             # Route Handlers
├── components/
│   ├── ui/              # shadcn/ui 컴포넌트
│   ├── layout/          # Header, Footer, MobileNav
│   ├── product/         # 상품 관련 컴포넌트
│   └── common/          # 공통 (Loading, Empty 등)
├── lib/
│   └── supabase/        # Supabase 클라이언트 3종
├── hooks/               # Custom hooks
├── types/               # TypeScript 타입
└── constants/           # 상수 (주문상태, 카테고리 등)
```

## DB 핵심 테이블
- profiles (auth.users 확장), addresses
- categories (self-join 계층), products, product_images, product_options
- orders, order_items (스냅샷 저장), payments (raw_response jsonb)
- coupons, user_coupons, point_histories
- reviews, review_images
- naver_sync_logs

## 주의사항
- 주문/주문상품은 반드시 스냅샷 저장 (상품 변경돼도 주문 데이터 보존)
- 네이버 스마트스토어 매핑: naver_product_no, naver_option_id 필드 유지
- 토스페이먼츠 응답은 raw_response jsonb로 원본 보관
- RLS 필수: 고객 데이터는 본인 것만 접근 가능
- 모바일 퍼스트 디자인
- 어드민은 이메일 화이트리스트로 접근 제어 (ADMIN_EMAILS 환경변수)

## Git Conventions

### Commit Format

```
<type>(<scope>): <subject>
```

| Type | Usage |
|------|-------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 코드 구조 개선 (동작 변경 없음) |
| `style` | UI/스타일링 변경 |
| `docs` | 문서 수정 |
| `chore` | 설정/빌드/의존성 |
| `test` | 테스트 추가/수정 |

- Subject: **50자 이내**, 마침표 없음, 한국어 작성
- **1 commit = 1 intent** (feature + refactor + format 섞지 말 것)
- Scope: product, cart, order, payment, auth, admin, review, naver, ui, db

### Pre-commit Checklist

1. `npx tsc --noEmit` — 타입 에러 0건
2. `npx next lint` — ESLint 에러 0건
3. `lib/`, `src/app/api/` 내 하드코딩된 시크릿 없음
4. `console.log` 잔존 여부 확인
5. `.env.local` staged 아닌지 확인

### Branch Strategy

- **main** ← feature/*, fix/*, refactor/*
- main 직접 푸시 금지, 반드시 PR을 통해 머지
- .env 파일: 절대 커밋 금지

---

## Definition of Done

- [ ] 코드 동작 확인 (최소 1개 검증된 경로)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx next lint` — 0 errors
- [ ] 실패 케이스 처리됨 (에러/빈 상태/로딩 UI)
- [ ] 네이밍과 구조가 의도를 드러냄
- [ ] PR description 작성 (What/Why/How)

---

## Slash Commands

Claude Code에서 사용 가능한 워크플로우:

| Command | 기능 |
|---------|------|
| `/commit` | Pre-commit 5단계 검증 + git commit |
| `/push` | 원격 푸시 (안전 검사 포함) |
| `/pr` | PR 템플릿 자동 생성 |
| `/test` | vitest 테스트 실행 |
| `/review-cycle` | 전체 품질 점검 (lint → tsc → test → security → commit-ready) |
| `/code-review` | 체크리스트 기반 구조화된 코드 리뷰 |

---

## Skills (자동 실행)
`.claude/skills/` 폴더에 정의된 스킬은 대화 맥락에 따라 자동으로 실행됨:
- **code-review**: 코드 리뷰 요청 시 → 보안/결제/타입 안전성 중심 검사
- **commit**: 커밋 요청 시 → pre-commit 5단계 검증 + Conventional Commits 자동 생성
- **test**: 테스트 요청 시 → vitest 기반 테스트 작성/실행 (Supabase 모킹)
- **pr**: PR 요청 시 → 변경사항 분석 + PR 템플릿 자동 생성
- **review-cycle**: 품질 점검 요청 시 → lint/tsc/test/security 전체 순회 후 commit-ready 판정
CLAUDE_EOF

echo "✅ CLAUDE.md 업데이트 (Git Conventions + DoD + Slash Commands)"

# ─────────────────────────────────────────────
# commit SKILL.md (v2 — 50자 제한, 5단계 검증)
# ─────────────────────────────────────────────
cat > .claude/skills/commit/SKILL.md << 'SKILL_EOF'
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
SKILL_EOF

echo "✅ commit 스킬 업데이트 (50자 제한, 5단계 검증)"

# ─────────────────────────────────────────────
# review-cycle SKILL.md (신규)
# ─────────────────────────────────────────────
cat > .claude/skills/review-cycle/SKILL.md << 'SKILL_EOF'
---
name: review-cycle
description: 전체 품질 점검 사이클을 실행합니다. "리뷰 사이클", "review cycle", "품질 점검", "전체 검사", "커밋 전 검사" 등의 요청 시 자동 실행.
---

# 전체 품질 점검 사이클

lint → tsc → test → security → commit-ready 순서로 전체 코드 품질을 검증한다.
각 단계가 모두 통과해야 "Commit Ready" 판정을 내린다.

## 실행 절차

### Phase 1: Lint (코드 스타일)

```bash
npx next lint
```

- 0 errors → ✅ PASS
- errors 존재 → ❌ FAIL, 자동 수정 시도: `npx next lint --fix` 후 재검사

### Phase 2: Type Check (타입 안전성)

```bash
npx tsc --noEmit
```

- 0 errors → ✅ PASS
- errors 존재 → ❌ FAIL, 에러 목록 출력 후 수정 제안

### Phase 3: Test (테스트)

```bash
# vitest가 설치되어 있으면
npx vitest run 2>/dev/null

# 없으면 빌드로 대체 검증
npm run build
```

- 전체 통과 → ✅ PASS
- 실패 → ❌ FAIL, 실패한 테스트 목록 + 수정 제안

### Phase 4: Security (보안 점검)

```bash
# 1. 환경변수 하드코딩 검사
echo "=== Secret Scan ==="
grep -rn "sk_live\|sk_test\|service_role\|supabase_service\|TOSS_SECRET\|toss_sk" src/ --include="*.ts" --include="*.tsx" | grep -v "process\.env\|\.env" || echo "✅ No hardcoded secrets"

# 2. console.log 잔존 검사
echo "=== Console.log Scan ==="
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test." || echo "✅ No stray console.log"

# 3. .env staged 검사
echo "=== .env Scan ==="
git diff --staged --name-only | grep -E "^\.env" && echo "🚨 .env STAGED!" || echo "✅ No .env staged"

# 4. Supabase 클라이언트 혼용 검사
echo "=== Supabase Client Misuse Scan ==="
grep -rn "supabase/admin" src/app/\(shop\)/ src/app/\(auth\)/ src/components/ --include="*.ts" --include="*.tsx" || echo "✅ No admin client in client code"
```

- 모든 항목 ✅ → PASS
- 1개라도 발견 → ❌ FAIL

### Phase 5: Commit-Ready 판정

## 결과 출력 형식

```
## 🔄 Review Cycle 결과

| Phase | 상태 | 비고 |
|-------|------|------|
| Lint | ✅/❌ | ESLint errors: N |
| Type Check | ✅/❌ | tsc errors: N |
| Test | ✅/❌ | passed/failed/skipped |
| Security | ✅/❌ | issues: N |

### 최종 판정: ✅ Commit Ready / ❌ Not Ready

[❌ 항목이 있으면 수정 필요 사항 목록]
```

## 판정 기준

- **4/4 PASS** → ✅ **Commit Ready** — 바로 커밋 가능
- **3/4 PASS** (Security만 FAIL) → ⚠️ **조건부 Ready** — 보안 이슈 수정 후 커밋
- **그 외** → ❌ **Not Ready** — 수정 필요
SKILL_EOF

echo "✅ review-cycle 스킬 생성 (신규)"

# ─────────────────────────────────────────────
# 나머지 기존 스킬 유지 (code-review, test, pr)
# ─────────────────────────────────────────────

# code-review가 없으면 생성 (이미 있으면 스킵)
if [ ! -f ".claude/skills/code-review/SKILL.md" ]; then
  echo "⚠️  code-review 스킬이 없습니다. 먼저 이전 setup-skills.sh를 실행해주세요."
fi

if [ ! -f ".claude/skills/test/SKILL.md" ]; then
  echo "⚠️  test 스킬이 없습니다. 먼저 이전 setup-skills.sh를 실행해주세요."
fi

if [ ! -f ".claude/skills/pr/SKILL.md" ]; then
  echo "⚠️  pr 스킬이 없습니다. 먼저 이전 setup-skills.sh를 실행해주세요."
fi

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
      "Bash(gh auth:*)",
      "Bash(grep:*)"
    ]
  }
}
JSON_EOF

echo "✅ settings.local.json 업데이트 (grep 권한 추가)"

echo ""
echo "=========================================="
echo "🎉 Claude Code Skills v2 설치 완료!"
echo "=========================================="
echo ""
echo "v2 변경사항:"
echo "  📝 CLAUDE.md — Git Conventions + Definition of Done + Slash Commands"
echo "  📦 commit 스킬 — 50자 제한, 1 commit = 1 intent, 5단계 pre-commit"
echo "  🔄 review-cycle 스킬 — 신규 (lint→tsc→test→security→commit-ready)"
echo ""
echo "전체 스킬 목록:"
echo "  📋 /code-review  — 보안/결제/타입 안전성 코드 리뷰"
echo "  📦 /commit       — 5단계 pre-commit + Conventional Commits"
echo "  🧪 /test         — vitest 테스트 작성/실행"
echo "  🔀 /pr           — PR 템플릿 자동 생성"
echo "  🔄 /review-cycle — 전체 품질 점검 사이클 (신규!)"
echo ""
echo "커밋하려면:"
echo "  git add -A"
echo "  git commit -m 'chore: Claude Code Skills v2 (Git Conventions + review-cycle)'"
echo "  git push origin main"
