# 쥴리씨 (Jullyssy Mall)

> 여성의류 자사몰 — 네이버 스마트스토어에서 자사몰로의 전환 프로젝트

🛍️ **[jullyssy.shop](https://jullyssy.shop)** 에서 확인하세요

---

## 소개

네이버 스마트스토어로 운영하던 여성의류 쇼핑몰을 자사몰로 확장한 프로젝트입니다.
1인 바이브코딩 개발로 1개월 만에 런칭했습니다.

**타겟**: 20~40대 여성  
**벤치마킹**: [아뜨랑스(attrangs.co.kr)](https://attrangs.co.kr) — 미니멀/모던 화이트 톤

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes (Route Handlers) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| 결제 | 토스페이먼츠 |
| 배포 | Vercel + Supabase Cloud (Seoul) |
| 폰트 | Pretendard |
| E2E 테스트 | Playwright |

---

## 주요 기능

### 고객 기능
- **회원**: 이메일/비밀번호 + 카카오 소셜 로그인
- **상품**: 카테고리 탐색, 색상×사이즈 옵션 선택, 컬러칩 UI, 이미지 갤러리
- **장바구니**: 비로그인 장바구니(localStorage) → 로그인 시 DB 병합
- **주문/결제**: 토스페이먼츠 (카드/계좌이체/카카오페이/네이버페이)
- **쿠폰**: 코드 입력, 정액/정률 할인, 최소 주문금액 조건
- **마이페이지**: 주문 내역/취소, 배송 추적, 배송지 관리, 쿠폰함
- **리뷰**: 구매 확정 후 별점+이미지 리뷰 (키/몸무게/사이즈 포함)

### 어드민 기능
- 상품 관리 (등록/수정/삭제, 옵션별 재고, 썸네일 그리드)
- 주문 관리 (상태 변경, 송장번호 입력)
- 쿠폰 관리 (발급/비활성화)
- 네이버 스마트스토어 상품 임포트 (배치 선택 임포트)

---

## 아키텍처 특징

```
브라우저 → Next.js (Vercel)
              ├── Server Components (SSR, SEO)
              ├── API Routes (비즈니스 로직)
              │     ├── Supabase Browser Client (고객 RLS)
              │     └── Supabase Admin Client (어드민, RLS 바이패스)
              └── Supabase Cloud (Seoul)
                    ├── PostgreSQL (13개 마이그레이션)
                    ├── Auth (Kakao OAuth)
                    └── Storage (상품 이미지)
```

**핵심 설계 결정**
- 주문/주문상품 스냅샷 저장 — 상품 정보 변경돼도 주문 데이터 보존
- 재고 차감 RPC 함수로 원자적 처리 — race condition 방지
- 토스페이먼츠 `raw_response jsonb` 원본 보관 — 분쟁 대비
- 어드민 API Route는 service role client 사용 — RLS 바이패스

---

## 로컬 개발 환경 세팅

### 사전 요구사항
- Node.js 18+
- Supabase 프로젝트 (Seoul 리전 권장)
- 토스페이먼츠 테스트 계정
- 카카오 개발자 앱

### 1. 클론 및 의존성 설치

```bash
git clone https://github.com/kaos1025/jullyssy-mall.git
cd jullyssy-mall
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 생성하고 아래 값을 입력합니다:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 토스페이먼츠 (테스트)
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxxxxxx
TOSS_SECRET_KEY=test_sk_xxxxxxx

# 어드민 접근 제어
ADMIN_EMAILS=your@email.com

# 네이버 커머스 API (선택)
NAVER_COMMERCE_CLIENT_ID=your_client_id
NAVER_COMMERCE_CLIENT_SECRET=your_client_secret\$your_secret

# Sentry (에러 모니터링, production 활성)
NEXT_PUBLIC_SENTRY_DSN=https://[key]@o[org-id].ingest.us.sentry.io/[project-id]
SENTRY_AUTH_TOKEN=sntrys_xxxxxxx
SENTRY_ORG=jullyssy
SENTRY_PROJECT=javascript-nextjs

# SEO 사이트 인증 (선택, 발급 후 주입)
# Naver: https://searchadvisor.naver.com/  Google: https://search.google.com/search-console/
NEXT_PUBLIC_NAVER_SITE_VERIFICATION=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
```

> ⚠️ `$` 포함된 시크릿은 `.env.local`에서 `\$`로 이스케이프 필요

### 3. DB 마이그레이션

Supabase 대시보드 SQL Editor에서 `supabase/migrations/` 폴더의 파일을 순서대로 실행:

```
001_initial_schema.sql       # 기본 스키마 (profiles, products, orders 등)
002_rls_policies.sql         # Row Level Security 정책
003_create_order_rpc.sql     # 주문 생성 원자적 RPC
004_add_is_reviewed.sql
005_add_product_slug.sql
006_naver_category_mapping.sql
007_add_jeans_category.sql
008_add_search_tags.sql
009_fix_handle_new_user_marketing.sql
010_create_cart_items_table.sql
011_coupon_system_upgrade.sql
012_update_order_rpc_coupon.sql
013_add_free_shipping.sql
```

### 4. Supabase Auth 설정

대시보드 → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

Providers → Kakao:
- REST API Key + Client Secret 입력 후 활성화

### 5. 개발 서버 실행

```bash
npm run dev
# http://localhost:3000
```

어드민 접근: `http://localhost:3000/admin`  
(ADMIN_EMAILS에 등록된 계정으로 로그인 필요)

---

## 테스트

```bash
# E2E 테스트 (Playwright)
npm run test:e2e

# UI 모드로 실행
npm run test:e2e:ui

# 브라우저 표시하며 실행
npm run test:e2e:headed
```

테스트 시나리오: 회원가입 → 상품 조회 → 장바구니 → 결제 → 주문 확인 → 주문 취소 + 비로그인 장바구니 + 에러 케이스

---

## 배포

Vercel + Cloudflare DNS 조합으로 배포합니다.

> ⚠️ Cloudflare Proxy(주황 구름)는 **반드시 OFF** — Vercel SSL과 충돌

Vercel 환경변수에 위 `.env.local` 값 동일하게 설정.  
런칭 시 토스페이먼츠 라이브 키(`live_ck_...`, `live_sk_...`)로 교체.

---

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 로그인/회원가입
│   ├── (shop)/          # 고객 화면 (헤더+푸터 레이아웃)
│   ├── admin/           # 관리자 (이메일 화이트리스트 가드)
│   └── api/             # Route Handlers
├── components/
│   ├── ui/              # shadcn/ui 컴포넌트
│   ├── layout/          # Header, Footer, MobileNav
│   ├── product/         # 상품 관련 컴포넌트
│   └── common/          # 공통 (Loading, Empty 등)
├── lib/
│   └── supabase/        # client / server / admin 3종 분리
├── hooks/               # Custom hooks
├── types/               # TypeScript 타입
└── constants/           # 주문상태, 택배사, 배송비 정책 등
```

---

## 카테고리 구조

```
상의        > 티셔츠 / 니트 / 셔츠 / 블라우스
하의        > 팬츠 / 스커트 / 레깅스 / 청바지
아우터      > 자켓 / 코트 / 패딩
원피스/세트
가방/악세서리
```

---

## License

Private project. All rights reserved.
