-- =============================================
-- P1-21: 주문 취소 actor/reason 메타데이터
-- =============================================
-- 사용자 멘탈 모델("구매자/판매자/시스템 취소") vs 시스템 라벨("취소완료") mismatch 해소.
-- 마이페이지 목록은 "취소완료" 통일 유지, 주문 상세에서 사유 노출 (한국 이커머스 관행).
--
-- TEXT + CHECK constraint 채택 (vs Postgres ENUM): ALTER 부담 없음, Supabase 타입
-- generator는 CHECK union literal 미변환이므로 lib/order/cancellation.ts에서 별도 export.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancellation_actor TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_note TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_cancellation_actor_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_cancellation_actor_check
  CHECK (cancellation_actor IS NULL OR cancellation_actor IN ('USER','ADMIN','SYSTEM'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_cancellation_reason_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_cancellation_reason_check
  CHECK (cancellation_reason IS NULL OR cancellation_reason IN (
    'CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'ORDER_ERROR',
    'AUTO_EXPIRED', 'PAYMENT_FAILURE', 'OTHER'
  ));

-- 분석 group by 가속용 부분 인덱스 (CANCELLED만 대상)
CREATE INDEX IF NOT EXISTS idx_orders_cancellation_reason
  ON orders (cancellation_reason)
  WHERE status = 'CANCELLED';

-- expire_pending_orders() 재정의 — actor='SYSTEM', reason='AUTO_EXPIRED' 함께 저장.
-- 본문 외 시그니처 동일, cron 등록 영향 없음(같은 함수명 CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_profile_point INT;
  v_expired_count INT := 0;
BEGIN
  FOR v_order IN
    SELECT id, user_id, point_used, coupon_id
    FROM orders
    WHERE status = 'PENDING'
      AND created_at < NOW() - INTERVAL '30 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR v_item IN
      SELECT product_option_id, quantity
      FROM order_items
      WHERE order_id = v_order.id
        AND product_option_id IS NOT NULL
    LOOP
      UPDATE product_options
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_option_id;
    END LOOP;

    IF v_order.coupon_id IS NOT NULL THEN
      UPDATE user_coupons
      SET used_at = NULL, order_id = NULL
      WHERE order_id = v_order.id;
    END IF;

    IF v_order.point_used > 0 THEN
      SELECT point INTO v_profile_point
      FROM profiles
      WHERE id = v_order.user_id;

      IF v_profile_point IS NOT NULL THEN
        UPDATE profiles
        SET point = point + v_order.point_used
        WHERE id = v_order.user_id;
      END IF;

      INSERT INTO point_histories (user_id, amount, reason, order_id)
      VALUES (
        v_order.user_id,
        v_order.point_used,
        '주문 자동 만료 환불',
        v_order.id
      );
    END IF;

    UPDATE orders
    SET
      status = 'CANCELLED',
      cancellation_actor = 'SYSTEM',
      cancellation_reason = 'AUTO_EXPIRED'
    WHERE id = v_order.id;

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;
