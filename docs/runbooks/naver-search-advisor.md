# 네이버 서치어드바이저 등록 절차서

> 대상: 운영자 / 작성 근거: US-3 (feat/naver-search-discoverability)
> 핵심 목적: **jullyssy.shop을 네이버 웹마스터도구에 등록해 수집·검색 노출 확보.**

---

## 0. 개요 — 왜 지금 해야 하는가

네이버는 국내 검색 점유율 1위로, 20~40대 여성 타겟 유입의 핵심 채널이다. 자사몰은 구글 인덱싱과 별도로 **네이버 서치어드바이저(searchadvisor.naver.com)에 별도 등록**해야 Yeti(네이버 봇)가 수집하고, 네이버 검색 결과·쇼핑 노출로 이어진다. 본 절차서는 사이트 등록부터 수집 요청·모니터링까지 전 과정을 단계별로 안내한다.

### 코드 측 준비 상태 (운영자 액션 불필요)
| 자산 | 파일 | 상태 |
|---|---|---|
| 인증 메타태그 | `src/app/layout.tsx` (37–45줄) | ✅ `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` env → `<meta name="naver-site-verification">` 자동 렌더 |
| 사이트맵 | `src/app/sitemap.ts` | ✅ `/sitemap.xml` 자동 생성 |
| RSS 피드 | `src/app/rss.xml/route.ts` | ✅ `/rss.xml` 자동 생성 |
| robots.txt | `src/app/robots.ts` | ✅ Yeti `*` 허용 (수집 차단 없음) |
| OG 이미지 | `src/app/opengraph-image.tsx` | ✅ 공유/미리보기 자산 준비됨 |

---

## 사전 준비물

- **네이버 계정**: 서치어드바이저에 로그인할 운영자 계정 (개인 또는 사업자).
- **Vercel 대시보드 접근 권한**: `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` 환경변수 설정용.
- **운영 도메인**: `https://jullyssy.shop` (이하 `<PROD_URL>`).
- (선택) 브라우저 개발자도구 — 메타태그 렌더 확인용.

---

## 등록 6단계

### 1단계 — 서치어드바이저 접속 + 사이트 등록

1. 브라우저에서 **[https://searchadvisor.naver.com](https://searchadvisor.naver.com)** 접속 → 네이버 계정으로 로그인.
2. 상단 메뉴 **웹마스터도구** 클릭.
3. 사이트 추가 입력란에 `https://jullyssy.shop` 입력 → **등록** 버튼.

**합격 기준**
- 사이트가 목록에 `https://jullyssy.shop`으로 추가됨.

✅ 적용 / 확인: _______________

---

### 2단계 — 소유확인 (메타태그 방식)

사이트를 등록하면 네이버가 **소유확인 코드**를 발급한다. 이 프로젝트는 이미 메타태그 방식으로 연결돼 있으므로, env 값이 코드와 일치하는지만 확인하면 된다.

#### 2-A. 인증코드 확인
1. 웹마스터도구 → 등록한 사이트 클릭 → **소유확인** 탭.
2. 방법 선택: **HTML 태그** 선택.
3. 화면에 표시된 인증코드 복사 (예: `abc123xyz...`).

#### 2-B. env 정합 확인
```
Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
→ NEXT_PUBLIC_NAVER_SITE_VERIFICATION 값 확인
```

- **일치하면** → 2-C로 바로 진행.
- **불일치하면** → Vercel env 값을 서치어드바이저 인증코드로 갱신 → **Production 재배포 1회** → 재배포 완료 후 2-C 진행.

#### 2-C. 렌더 확인 (브라우저)
```
https://jullyssy.shop 접속 → 개발자도구(F12) → Elements 탭
→ <head> 안에서 아래 태그 확인:
<meta name="naver-site-verification" content="<인증코드>">
```

#### 2-D. 소유확인 완료
1. 서치어드바이저 소유확인 탭 → **소유확인** 버튼 클릭.
2. "소유가 확인되었습니다" 메시지 확인.

**합격 기준**
- env 값 = 서치어드바이저 인증코드 (정확히 일치).
- `<head>`에 메타태그 렌더됨.
- 소유확인 완료 상태.

✅ 적용 / 확인: _______________

---

### 3단계 — 사이트맵 제출

1. 웹마스터도구 → 사이트 선택 → 좌측 메뉴 **요청** → **사이트맵 제출**.
2. 입력란에 아래 URL 입력:
   ```
   https://jullyssy.shop/sitemap.xml
   ```
3. **확인** 버튼 클릭.

**합격 기준**
- 제출 완료 메시지 및 제출 이력에 사이트맵 URL이 등록됨.
- (선택) 브라우저에서 `https://jullyssy.shop/sitemap.xml` 직접 접속 → XML 형식 응답 확인.

✅ 적용 / 확인: _______________

---

### 4단계 — RSS 제출 (신규·변경 상품 빠른 수집)

RSS 피드를 제출하면 신규 입고 및 상품 변경 시 Yeti가 더 빠르게 재수집한다.

1. 웹마스터도구 → 사이트 선택 → 좌측 메뉴 **요청** → **RSS 제출**.
2. 입력란에 아래 URL 입력:
   ```
   https://jullyssy.shop/rss.xml
   ```
3. **확인** 버튼 클릭.

**합격 기준**
- 제출 완료 메시지 및 제출 이력에 RSS URL이 등록됨.
- (선택) 브라우저에서 `https://jullyssy.shop/rss.xml` 직접 접속 → RSS/XML 형식 응답 확인.

✅ 적용 / 확인: _______________

---

### 5단계 — 수집 요청 (선택 · 빠른 색인용)

신규 사이트는 Yeti 자동 순회까지 시간이 걸릴 수 있다. 핵심 URL을 수동 수집 요청하면 색인이 앞당겨진다.

1. 웹마스터도구 → 사이트 선택 → 좌측 메뉴 **요청** → **웹페이지 수집**.
2. 아래 URL을 순서대로 입력 후 각각 **수집 요청**:

| URL | 설명 |
|---|---|
| `https://jullyssy.shop` | 홈 |
| `https://jullyssy.shop/products` | 전체 상품 목록 |
| `https://jullyssy.shop/welcome` | 웰컴 랜딩(WELCOME5000 쿠폰) |
| `https://jullyssy.shop/guide` | 쇼핑 안내 (FAQPage 스키마) |
| 대표 상품 PDP 1~3건 | 예: `https://jullyssy.shop/products/<slug>` |

> 하루 최대 요청 건수가 제한될 수 있으므로 핵심 URL부터 우선 제출.

**합격 기준**
- 각 URL 수집 요청 완료 메시지.

✅ 적용 / 확인: _______________

---

### 6단계 — 진단·모니터링 체크리스트

수집 후 정기적으로 점검한다. **노출까지 통상 수일~수주 소요** (신규 도메인 기준).

#### robots.txt 허용 확인
```
https://jullyssy.shop/robots.txt 접속 → Yeti(또는 *) 허용(Disallow 없음) 확인
```
- `src/app/robots.ts`는 이미 `*` allow로 설정돼 있어 별도 조치 불필요.

#### 사이트 최적화 진단
웹마스터도구 → **사이트 최적화** → 진단 실행.
- 웹표준(HTML 유효성), 오픈그래프(OG 태그), robots 허용 여부 점검.
- 경고 항목이 있으면 해당 코드 파일 기준으로 수정.

#### 수집 현황 확인
웹마스터도구 → **현황** → 수집 통계.
- Yeti 수집 건수가 점진적으로 증가하는지 확인.

#### 네이버 검색 노출 확인
네이버 검색창에서:
```
site:jullyssy.shop
```
- 색인된 URL 목록이 나타나기 시작하면 수집 성공.
- 초기엔 0건이 정상 — 수일~수주 후 재확인.

#### OG 미리보기 확인
- 네이버 블로그 또는 카카오톡에 `https://jullyssy.shop` URL 붙여넣기 → 썸네일·제목·설명 미리보기 정상 노출 확인.
- 이상 시 `src/app/opengraph-image.tsx` 및 `layout.tsx`의 OG 메타 점검.

✅ 적용 / 확인: _______________

---

## 롤백·이슈 대응

| 증상 | 원인 | 조치 |
|---|---|---|
| 소유확인 실패 | env 값 불일치 또는 메타태그 미렌더 | Vercel env 갱신 → 재배포 → 2-C 재확인 |
| 사이트맵 제출 오류 | `/sitemap.xml` 응답 없음 또는 형식 오류 | `src/app/sitemap.ts` 확인, 브라우저에서 직접 접속 테스트 |
| RSS 제출 오류 | `/rss.xml` 응답 없음 | `src/app/rss.xml/route.ts` 확인 |
| Yeti 수집 차단 | robots.txt Disallow 설정 | `src/app/robots.ts` 확인 (현재 `*` allow — 문제 없음) |
| 노출 장기 미발생 | 신규 도메인 신뢰도 축적 대기 | 2~4주 대기 후 `site:jullyssy.shop` 재확인 |

---

## 부록 — 빠른 참조

| 항목 | 값 |
|---|---|
| 서치어드바이저 콘솔 | [https://searchadvisor.naver.com](https://searchadvisor.naver.com) |
| 운영 도메인 | `https://jullyssy.shop` |
| 사이트맵 URL | `https://jullyssy.shop/sitemap.xml` |
| RSS URL | `https://jullyssy.shop/rss.xml` |
| 소유확인 env | `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` (Vercel → Environment Variables) |
| 인증 메타태그 위치 | `src/app/layout.tsx` 37–45줄 |
| 사이트맵 소스 | `src/app/sitemap.ts` |
| RSS 소스 | `src/app/rss.xml/route.ts` |
| robots 소스 | `src/app/robots.ts` |
| OG 이미지 소스 | `src/app/opengraph-image.tsx` |
| 노출 확인 네이버 검색어 | `site:jullyssy.shop` |
| 예상 색인 소요 기간 | 수일~수주 (신규 도메인 기준) |

### 범위 밖 (후속 과제)
- **네이버쇼핑 피드**: 쇼핑 탭 노출을 위한 별도 피드 연동 (네이버 커머스 API 또는 쇼핑 파트너센터).
- **네이버 애널리틱스**: 유입 분석을 위한 로그 분석 스크립트 삽입.
- 위 두 항목은 본 절차서 범위 밖이며 별도 US로 관리.
