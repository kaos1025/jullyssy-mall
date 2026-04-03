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
- main 직접 푸시 금지, 사용자 요청했을때 외에는 반드시 PR을 통해 머지
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
