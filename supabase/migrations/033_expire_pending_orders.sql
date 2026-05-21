-- =============================================
-- P1-20: PENDING 주문 자동 만료 (30분 TTL)
-- =============================================
-- 결제 confirm 단계로 진입하지 못한 PENDING 주문을 정리.
-- (a) 사용자가 토스 결제창을 X/뒤로가기로 닫음 — 클라이언트 cleanup API 호출 실패 케이스 보완
-- (b) 클라이언트가 cleanup API 자체를 호출하지 않은 레거시 케이스 보완 (이 hotfix 이전 누적분 포함)
--
-- 정리 로직은 cleanupPendingOrder() TS 함수와 동일 (재고 → 쿠폰 → 포인트 → status 전이).
-- status enum은 CANCELLED 통일 (handlePaymentFailure와 동일 패턴, P1-20 결정 1 옵션 B).

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
  -- 30분 이상 PENDING 상태인 주문을 잠금 후 정리 (동시 cron/요청 충돌 방지)
  FOR v_order IN
    SELECT id, user_id, point_used, coupon_id
    FROM orders
    WHERE status = 'PENDING'
      AND created_at < NOW() - INTERVAL '30 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 1. 재고 원복
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

    -- 2. 쿠폰 원복
    IF v_order.coupon_id IS NOT NULL THEN
      UPDATE user_coupons
      SET used_at = NULL, order_id = NULL
      WHERE order_id = v_order.id;
    END IF;

    -- 3. 포인트 환불
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

    -- 4. orders 상태 전이 (CANCELLED 통일)
    UPDATE orders
    SET status = 'CANCELLED'
    WHERE id = v_order.id;

    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

-- 5분 주기 cron 등록. 기존 등록 있으면 갱신.
SELECT cron.unschedule('expire-pending-orders-every-5-min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-orders-every-5-min'
);

SELECT cron.schedule(
  'expire-pending-orders-every-5-min',
  '*/5 * * * *',
  $$SELECT expire_pending_orders();$$
);
