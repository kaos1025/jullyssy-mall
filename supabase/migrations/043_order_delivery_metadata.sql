-- =============================================
-- P1-3-A: 배송 자동완료 — 타임스탬프 + 완료주체(actor) 메타데이터
-- =============================================
-- SHIPPING → DELIVERED 자동 전환(Sweet Tracker 폴링)을 위한 컬럼 신설.
--
-- delivered_at  : 배송완료 시각. 자동완료 cron과 수동 admin PATCH가 공통 기록.
-- delivered_via : 완료 주체. 'ADMIN'(수동 입력) | 'SYSTEM'(자동 폴링). 어드민 badge SSOT.
-- shipped_at    : 배송시작(SHIPPING 전환) 시각. 폴링 윈도우/쿼터 보호 + 배송기간 분석 기반.
--
-- 모두 nullable 추가 → 기존 행 영향 0. cancellation_actor(035) CHECK 패턴 미러.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_via TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivered_via_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_delivered_via_check
  CHECK (delivered_via IS NULL OR delivered_via IN ('ADMIN', 'SYSTEM'));

-- 폴링 대상(SHIPPING + 송장 보유) 조회 가속용 부분 인덱스.
-- shipped_at 정렬/윈도우 조건과 정합 (NULL shipped_at 행도 색인에 포함 → 폴링 누락 없음).
CREATE INDEX IF NOT EXISTS idx_orders_shipping_poll
  ON orders (shipped_at)
  WHERE status = 'SHIPPING' AND tracking_no IS NOT NULL;
