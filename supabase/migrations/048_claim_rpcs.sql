-- =============================================
-- P1-16 RETURN-EXCHANGE-FLOW: 부수효과 RPC (단일 트랜잭션)
-- =============================================
-- spec v0.2 §3-2, §3-4. cancelOrder의 무트랜잭션·fire-and-forget 패턴 상속 금지 —
-- 재고/포인트/쿠폰/적립회수/상태를 단일 트랜잭션으로 묶어 부분 실패 시 전체 롤백.
-- 보안: 환불/재고 이동 함수 → anon/authenticated 직접 실행 차단, service_role(서버)만 허용.

-- ---------------------------------------------
-- process_return_refund: 반품 환불 확정 (Toss 부분취소는 오케스트레이션이 선행 실행)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION process_return_refund(
  p_claim_id uuid,
  p_refund_amount int,
  p_processed_by uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim order_claims%ROWTYPE;
  v_order orders%ROWTYPE;
  v_accrued int;
  v_balance int;
  v_recover int;
  v_item record;
BEGIN
  SELECT * INTO v_claim FROM order_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found: %', p_claim_id; END IF;
  IF v_claim.status <> 'COLLECTED' THEN
    RAISE EXCEPTION 'claim % not COLLECTED (current: %)', p_claim_id, v_claim.status;
  END IF;
  IF v_claim.type <> 'RETURN' THEN
    RAISE EXCEPTION 'claim % is not RETURN', p_claim_id;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_claim.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found for claim %', p_claim_id; END IF;

  -- 1. 재고 원복 (order_items 전 행)
  FOR v_item IN
    SELECT product_option_id, quantity FROM order_items
    WHERE order_id = v_order.id AND product_option_id IS NOT NULL
  LOOP
    UPDATE product_options SET stock = stock + v_item.quantity
    WHERE id = v_item.product_option_id;
  END LOOP;

  -- 2. 사용 포인트 원복
  IF v_order.point_used > 0 THEN
    UPDATE profiles SET point = point + v_order.point_used WHERE id = v_order.user_id;
    INSERT INTO point_histories (user_id, amount, reason, order_id)
    VALUES (v_order.user_id, v_order.point_used, '반품 환불', v_order.id);
  END IF;

  -- 3. 쿠폰 원복
  IF v_order.coupon_id IS NOT NULL THEN
    UPDATE user_coupons SET used_at = NULL, order_id = NULL
    WHERE order_id = v_order.id AND coupon_id = v_order.coupon_id;
  END IF;

  -- 4. 적립 포인트 회수 (구매확정 적립분, 현재 잔액 하한)
  SELECT COALESCE(SUM(amount), 0) INTO v_accrued
  FROM point_histories WHERE order_id = v_order.id AND reason = '구매확정 적립';
  IF v_accrued > 0 THEN
    SELECT point INTO v_balance FROM profiles WHERE id = v_order.user_id FOR UPDATE;
    v_recover := LEAST(v_accrued, v_balance);
    IF v_recover > 0 THEN
      UPDATE profiles SET point = point - v_recover WHERE id = v_order.user_id;
      INSERT INTO point_histories (user_id, amount, reason, order_id)
      VALUES (v_order.user_id, -v_recover, '반품 적립 회수', v_order.id);
    END IF;
    IF v_recover < v_accrued THEN
      RAISE NOTICE '적립 회수 부족(잔액부족): accrued=% recovered=%', v_accrued, v_recover;
    END IF;
  END IF;

  -- 5. payments 상태 (부분/전액). 원 승인 raw_response 보존, 취소 raw는 claim.toss_cancel_response.
  UPDATE payments
  SET status = CASE WHEN p_refund_amount < v_order.paid_amount
                    THEN 'PARTIAL_CANCELLED' ELSE 'CANCELLED' END
  WHERE order_id = v_order.id AND status IN ('DONE', 'PARTIAL_CANCELLED');

  -- 6. orders + claim 종결
  UPDATE orders SET status = 'RETURNED' WHERE id = v_order.id;
  UPDATE order_claims
  SET status = 'REFUNDED', refund_amount = p_refund_amount,
      processed_by = COALESCE(p_processed_by, processed_by), completed_at = now()
  WHERE id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION process_return_refund(uuid, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_return_refund(uuid, int, uuid) FROM anon;
REVOKE ALL ON FUNCTION process_return_refund(uuid, int, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_return_refund(uuid, int, uuid) TO service_role;

-- ---------------------------------------------
-- process_exchange_reship: 교환 재발송 (단일 SKU 주문 — spec 제약)
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION process_exchange_reship(
  p_claim_id uuid,
  p_tracking text,
  p_courier text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim order_claims%ROWTYPE;
  v_old_option uuid;
  v_qty int;
  v_new_stock int;
BEGIN
  SELECT * INTO v_claim FROM order_claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim not found: %', p_claim_id; END IF;
  IF v_claim.status <> 'COLLECTED' THEN
    RAISE EXCEPTION 'claim % not COLLECTED (current: %)', p_claim_id, v_claim.status;
  END IF;
  IF v_claim.type <> 'EXCHANGE' THEN
    RAISE EXCEPTION 'claim % is not EXCHANGE', p_claim_id;
  END IF;
  IF v_claim.exchange_to_option_id IS NULL THEN
    RAISE EXCEPTION 'claim % has no exchange_to_option_id', p_claim_id;
  END IF;

  -- 단일 SKU 주문(spec): order_items 1행
  SELECT product_option_id, quantity INTO v_old_option, v_qty
  FROM order_items WHERE order_id = v_claim.order_id
  ORDER BY created_at LIMIT 1;

  -- 기존 옵션 재고 복원
  IF v_old_option IS NOT NULL THEN
    UPDATE product_options SET stock = stock + v_qty WHERE id = v_old_option;
  END IF;

  -- 신규 옵션 재고 검증 + 차감 (row lock)
  SELECT stock INTO v_new_stock FROM product_options
  WHERE id = v_claim.exchange_to_option_id FOR UPDATE;
  IF v_new_stock IS NULL THEN
    RAISE EXCEPTION 'exchange option not found: %', v_claim.exchange_to_option_id;
  END IF;
  IF v_new_stock < v_qty THEN
    RAISE EXCEPTION 'insufficient stock: option % need % have %',
      v_claim.exchange_to_option_id, v_qty, v_new_stock;
  END IF;
  UPDATE product_options SET stock = stock - v_qty WHERE id = v_claim.exchange_to_option_id;

  -- claim RESHIPPED + 송장
  UPDATE order_claims
  SET status = 'RESHIPPED', reship_tracking_number = p_tracking, reship_courier = p_courier
  WHERE id = p_claim_id;
END;
$$;

REVOKE ALL ON FUNCTION process_exchange_reship(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_exchange_reship(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION process_exchange_reship(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_exchange_reship(uuid, text, text) TO service_role;
