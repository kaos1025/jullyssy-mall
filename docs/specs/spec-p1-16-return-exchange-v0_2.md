# spec-p1-16-return-exchange-v0.2

**작성**: 2026-06-10 · PM(claude.ai) · Phase 0 실측 보고(Claude Code) 반영 확정본
**대상**: P1-16 + B-7(webhook) + P2-22(vitest) 묶음 · **총 공수 8~12h, 3세션 분할**

> 본 파일은 Phase 0 이탈 1(repo에 spec 부재) 대응으로 Phase 1 PR에 커밋된 PM 확정 사본이다.

---

## 0. v0.1 → v0.2 변경 (Phase 0 실측 반영)

| # | 변경 | 근거 (Phase 0) |
|---|---|---|
| 1 | `members` → **`profiles`**, `member_id` → **`user_id`** (FK `profiles(id) ON DELETE CASCADE`) | item9: members 테이블 부재, FK 관례 실측 |
| 2 | 부수효과 아키텍처 = **ⓒ primitive 추출 + 오케스트레이션 분리** 채택. 단 **cancelOrder DB부 리팩토링은 비범위** — Toss 호출부만 신규 `tossCancel` primitive로 교체(거동 동일 + 멱등키 혜택) | A-4 판정 수용 + 가동 중 결제 경로 회귀 위험 차단 |
| 3 | 반품 DB 원복은 **단일 RPC `process_return_refund` 트랜잭션화** (cancelOrder의 무트랜잭션·fire-and-forget 패턴 상속 금지) | 이탈 3: Toss 성공 후 DB 부분 실패 = 회계 불일치 |
| 4 | **적립 포인트 회수 확정 포함** — confirm 시 1% 자동 적립 실측됨 | item10 |
| 5 | 신청 기한 판정 = `COALESCE(delivered_at, updated_at) + 7일` | item7: 043 이전 DELIVERED 행 NULL 가능 |
| 6 | **교환은 단일 SKU 주문(order_items 1행)만 허용** — 다품목 주문은 반품 후 재주문 안내 | 주문 단위 claim + `exchange_to_option_id` 단일 FK의 구조적 귀결 |
| 7 | 동일가 판정 기준 = `product_options.extra_price` 동일 여부 | item8: extra_price INT DEFAULT 0 실측 |
| 8 | webhook secret = **per-payment secret** (payments.secret + timingSafeEqual) — 글로벌 shared-secret 아님. CANCEL 이벤트의 secret 제공 여부 Phase 4 검증 게이트 | item11 |
| 9 | `payments.status` `PARTIAL_CANCELLED` 기존 존재 → 그대로 사용 | item15 |
| 10 | Toss 부분 취소: 호출 직전 `GET /v1/payments/{key}` 실조회로 `balanceAmount ≥ cancelAmount` 검증 (저장값 불신, 서버 권위) + `Idempotency-Key` 헤더 | item15 (a)(b)(c) |
| 11 | 이메일: 환불완료=`sendRefundCompleted` 재사용(부분환불 금액만 조정) / 교환 재발송=`ShippingStarted` 재사용 / **신규 2종**: ClaimApproved(회수 안내+차감액), ClaimRejected(사유) | item13 |
| 12 | `RETURN_CONFIG`는 `src/constants/shipping.ts`에 신설 (기존 SHIPPING_CONFIG 동거, 도서산간 6,000과 별개 축 명시) | item14 |
| 13 | `order_item_id` 컬럼 **채택 안 함** — item-level 부분 반품은 P2에서 `claim_items` 별도 테이블이 정합 (단일 FK는 다품목 부분반품 미지원) | CC 권고에 대한 PM 반려 |
| 14 | 마이페이지 Phase 3 작업 지점 = 기존 disabled placeholder 버튼(:307-311) 활성화 + `canReturn`에 CONFIRMED·7일 조건 확장 | item12 |

---

## 1. 정책 (확정)

- 신청 조건: `DELIVERED`/`CONFIRMED` + `COALESCE(delivered_at, updated_at)` 기준 7일 이내 + 주문당 활성 claim 1건
- 반품 = 주문 전체 단위. 교환 = **단일 SKU 주문만**, 동일 상품 내 `extra_price` 동일 옵션만, 수량 전체
- 차감액 (운영자 확정 2026-06-10): 단순변심 — 초도 무료배송 주문 **7,000** / 초도 유료배송 주문 **3,500** / 하자·오배송 **0**. 서버가 `reason_category` 기반 제안 → 운영자 승인 시 확정(수정 가능)
- 환불액 = 실결제액 − 확정 차감액 (서버 계산 권위)
- 교환 배송비(왕복 7,000, 단순변심): 온라인 추가 결제 비범위 — 운영자 수동 수취
- 회수 주소: 서울특별시 중구 장충단로13길 20 (현대시티타워) 12층 B-10/1,3호 — `RETURN_CONFIG.pickupAddress` SSOT
- 비범위(v1): item-level claim / 가격차 교환 / 교환비 온라인 결제 / 회수 택배 자동 접수 / 신청 사진 첨부 / cancelOrder DB부 리팩토링(P2)

```ts
// src/constants/shipping.ts 추가
export const RETURN_CONFIG = {
  returnShippingFee: 3500,      // 반품 편도
  roundTripShippingFee: 7000,   // 왕복 (초도 무료배송 주문 변심 / 교환 변심)
  pickupAddress: "서울특별시 중구 장충단로13길 20 (현대시티타워) 12층 B-10/1,3호",
  windowDays: 7,
} as const;
```

---

## 2. 데이터 모델 (마이그레이션 047)

```sql
CREATE TABLE order_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('RETURN','EXCHANGE')),
  status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','APPROVED','REJECTED','COLLECTED',
                      'REFUNDED','RESHIPPED','COMPLETED','WITHDRAWN')),
  reason_category text NOT NULL
    CHECK (reason_category IN ('CHANGE_OF_MIND','SIZE_MISMATCH','DEFECT','WRONG_ITEM','OTHER')),
  reason_detail text,
  prev_order_status text NOT NULL,            -- 거절/철회 시 원복용
  proposed_deduction int NOT NULL DEFAULT 0,
  confirmed_deduction int,
  refund_amount int,
  toss_cancel_idempotency_key text,           -- Toss 성공 기록 = RPC 재시도 시 Toss skip 마커
  toss_cancel_response jsonb,
  exchange_to_option_id uuid REFERENCES product_options(id),
  reship_tracking_number text,
  reship_courier text,
  rejected_reason text,
  processed_by uuid REFERENCES profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz, collected_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_active_claim_per_order ON order_claims (order_id)
  WHERE status IN ('REQUESTED','APPROVED','COLLECTED','RESHIPPED');
CREATE INDEX idx_order_claims_status ON order_claims (status);
```

- `reason_category → proposed_deduction` 매핑: DEFECT/WRONG_ITEM → 0, 그 외 → 초도 무료배송 여부에 따라 7000/3500. 초도 무료배송 판정 = 주문의 shipping_fee 0 여부 (Phase 1에서 orders 컬럼 실측 후 확정 — 가정 금지)
- RLS: 사용자 = 본인 row SELECT / INSERT(REQUESTED) / UPDATE는 REQUESTED→WITHDRAWN 전이만. 어드민 처리 = service_role API 경유. shared cache 진입 금지
- updated_at 트리거: 기존 관례 따름

### orders.status 연동 (status-transitions.ts 확장)

| claim 이벤트 | orders.status |
|---|---|
| REQUESTED | → `RETURN_REQUESTED` / `EXCHANGE_REQUESTED` (전이 시 `prev_order_status` 기록) |
| REFUNDED / COMPLETED | → `RETURNED` / `EXCHANGED` (terminal) |
| REJECTED / WITHDRAWN | → `prev_order_status` 원복 |

**어드민 드롭다운(`ADMIN_ORDER_STATUS_OPTIONS`) 변경 없음** — 반품/교환 4종 전이는 claim 함수 경유만. status-transitions.ts에 `CLAIM_DRIVEN_TRANSITIONS` 별도 화이트리스트 신설 (어드민 직접 전이 화이트리스트와 분리, vitest 대상).

---

## 3. 부수효과 아키텍처

### 3-1. primitive: `tossCancel` (`lib/payment/toss-cancel.ts`)
```
tossCancel(paymentKey, { cancelReason, cancelAmount?, idempotencyKey }): Promise<TossCancelResult>
```
1. `GET /v1/payments/{paymentKey}` → `balanceAmount` 실조회. `cancelAmount > balanceAmount` 시 즉시 에러 (호출 안 함)
2. `POST .../cancel` + `Idempotency-Key` 헤더. `cancelAmount` 생략 = 전액 (기존 거동)
3. 응답의 `balanceAmount` 반환: `> 0` → `PARTIAL_CANCELLED`, `= 0` → `CANCELLED` 판정값 포함
4. **cancelOrder의 기존 인라인 Toss 호출을 본 primitive로 교체** (cancelAmount 미지정 — 거동 동일). DB부는 손대지 않음

### 3-2. RPC `process_return_refund(p_claim_id, p_refund_amount, p_processed_by)` — 단일 트랜잭션
가드: claim status = `COLLECTED` (아니면 EXCEPTION — 멱등)
1. 재고 원복 — order_items 전 행
2. 사용 포인트 원복 — `profiles.point` row lock + `point_histories` insert("반품 환불")
3. 쿠폰 원복 — `user_coupons.used_at=null, order_id=null`
4. **적립 회수** — 해당 주문 "구매확정 적립" 이력 조회 → `LEAST(적립액, 현재 잔액)` 차감 + history("반품 적립 회수"). 잔액 부족분은 NOTICE → Sentry warning (환불 전체를 막지 않음)
5. `payments.status` = `cancelAmount < paid` 여부에 따라 `PARTIAL_CANCELLED`/`CANCELLED`
6. `orders.status = 'RETURNED'` / claim `status='REFUNDED', refund_amount, completed_at`

### 3-3. 오케스트레이션 `executeReturnRefund(claimId, ctx)`
```
① claim 가드(COLLECTED) + refund_amount 서버 계산 = paid − confirmed_deduction
② if (toss_cancel_idempotency_key 미존재) → tossCancel(부분) 성공 → claim에 key+response 선기록
   else → Toss skip (재시도 경로 — cancelOrder 복구 gap의 구조적 해소)
③ RPC process_return_refund 호출 → 실패 시 claim 불변 (②기록 잔존 → 재시도 시 ③만)
④ sendRefundCompleted(refund_amount)
```

### 3-4. RPC `process_exchange_reship(p_claim_id, p_tracking, p_courier)` — 단일 트랜잭션
가드: `COLLECTED` + type=EXCHANGE
1. 기존 옵션 재고 += qty / 신규 옵션(`exchange_to_option_id`) 재고 검증(`>= qty`, 부족 시 EXCEPTION) 후 −= qty
2. claim `RESHIPPED` + 송장 기록 → 앱에서 ShippingStarted 메일
3. 이후 운영자 [교환 완료] → claim `COMPLETED` + orders `EXCHANGED`

### 3-5. 결제 없는 전이 (승인/거절/철회/회수완료)
- 승인: `confirmed_deduction` 확정(기본=proposed) + `APPROVED` + ClaimApproved 메일(회수 주소+차감액 고지)
- 거절: `REJECTED` + 사유 + orders 원복 + ClaimRejected 메일
- 철회(사용자, REQUESTED만): `WITHDRAWN` + orders 원복
- 회수완료: `APPROVED → COLLECTED` (collected_at)

---

## 4. B-7 webhook (`api/payments/webhook/route.ts`)

- :17 단일 if → eventType 화이트리스트 분기(`PAYMENT_STATUS_CHANGED` | `CANCEL_STATUS_CHANGED`)로 구조화
- `CANCEL_STATUS_CHANGED` 처리:
  - 자사 발(클레임/취소 플로우) 동기화 완료 건 → no-op 멱등
  - 토스 콘솔 직접 **전액 취소** + DB 미취소 → cancelOrder 경로 동기화
  - **부분 취소** → 자동 동기화 제외, `payments.status=PARTIAL_CANCELLED` + raw 갱신 + Sentry warning(수동 정합)
- ⚠️ **Phase 4 검증 게이트**: Toss CANCEL 이벤트 payload에 per-payment `secret` 제공 여부 — 미제공 시 paymentKey로 `GET /v1/payments` 역조회 검증으로 대체 (검증 없는 수용 금지)

---

## 5. UI

### Phase 3 — 마이페이지
- `orders/[id]/page.tsx` 기존 placeholder 버튼(:307-311) 활성화. `canReturn = (DELIVERED|CONFIRMED) && within 7d && 활성 claim 없음`. 교환 버튼은 + `order_items 1행` 조건
- 신청 폼(모바일 Sheet/Dialog): type / reason_category / reason_detail / (교환) extra_price 동일+재고>0 옵션 셀렉트 / 예상 차감액 고지("확정 시 변동 가능")
- claim 진행 상태 표시 + REQUESTED 철회 버튼
- 상세 쿼리에 `claims:order_claims(*)` join 추가 (RLS SELECT로 본인 row만)

### Phase 2 — 어드민
- `/admin/claims` 목록(status 필터) + 상세. status별 단일 액션:
  REQUESTED → [승인(차감액 입력, 기본=제안값)] / [거절(사유)] · APPROVED → [회수 완료] · COLLECTED → RETURN [환불 실행(환불액 미리보기)] / EXCHANGE [재발송(송장)] · RESHIPPED → [교환 완료]
- 주문 상세에 활성 claim 배지+링크. verifyAdmin 필수 (Full Route Cache 방지)

---

## 6. Phase 구조

| Phase | 내용 | 공수 | 게이트 |
|---|---|---|---|
| 1 | 마이그(order_claims+RLS+RPC 2종) + RETURN_CONFIG + tossCancel primitive(+cancelOrder 교체) + status-transitions 확장 + returnOrderRefund/전이 API | 3.5~4.5h | **진입 전 item6 SQL 0건 확인(운영자)** · DB 우선 apply → 코드 |
| 2 | 어드민 claims UI | 2~3h | 운영자 화면 QA |
| 3 | 마이페이지 신청 UI + 이메일 신규 2종 | 2~3h | 테스트 주문 RETURN/EXCHANGE 전 구간 E2E |
| 4 | B-7 webhook + vitest(status-transitions+claim 전이) | 1~2h | webhook preview 동적 검증 + CANCEL secret 확인 |

### Phase 1 진입 게이트 — 운영자 SQL 1회 (대시보드 SQL editor)
- item6 행 0건 → Phase 1 진입. N건 → 정합 처리 선행(PM 보고)
- item7 미채움 존재 → COALESCE fallback 그대로 (이미 설계 반영)
- item8 가격차 존재 → 동일가 판정 로직 그대로 (이미 설계 반영)

**실측 결과 (2026-06-10)**: item6 = 0건 (PASS) / item7 = CONFIRMED 5/0·DELIVERED 4/3 (COALESCE fallback 필수 확인) / item8 = 0/271 (가격차 0).

---

## 7. Risks

| 리스크 | 대응 |
|---|---|
| Toss 성공 후 DB 실패 | §3-3 ② 선기록 + ③ RPC 단일 트랜잭션 + 재시도 시 Toss skip — cancelOrder 복구 gap 구조 해소 |
| 적립 회수 잔액 부족 | LEAST 하한 + NOTICE→Sentry warning, 환불 진행 유지 |
| CANCEL 이벤트 secret 미제공 가능성 | Phase 4 게이트 — GET 역조회 검증 대체안 준비 |
| webhook ↔ claim 플로우 이중 처리 | 부분 취소 자동 동기화 제외 + 멱등 no-op |
| 발생 0건 = 운영 검증 부재 | Phase 3 테스트 주문 E2E 의무 (소액 실결제 + 즉시 환불) |

## 8. done-done
- [ ] item6 0건 / RETURN E2E / EXCHANGE E2E / webhook preview 검증 / vitest 통과 / 어드민 QA / 운영자 매뉴얼 가이드 갱신 / spec 파일 repo 커밋
