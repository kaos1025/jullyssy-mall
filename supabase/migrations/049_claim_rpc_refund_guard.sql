-- =============================================
-- P1-16 hotfix: process_return_refund 방어 강화 (architect 리뷰 #5/#2)
-- =============================================
-- CREATE OR REPLACE — 048의 함수 정의를 대체. 권한(REVOKE/GRANT)은 보존되나 명시 재선언.
-- 추가: ① p_refund_amount > paid_amount 방어 assert(현재 오케스트레이션상 도달 불가, 미래 호출자 버그 차단)
--      ② 재진입 안전성이 COLLECTED 가드에만 의존함을 명시(재호출 시 상단 가드에서 EXCEPTION → 중복 복원 차단)

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
  -- 재진입 안전성은 아래 COLLECTED 가드(+ FOR UPDATE)에 전적으로 의존:
  -- 본 함수가 두 번 호출되면 두 번째는 여기서 EXCEPTION → 재고/포인트 중복 복원 불가.
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

  -- 방어(architect #5): 환불액은 결제액을 초과할 수 없다. 오케스트레이션이 max(0, paid-deduction)으로
  -- 보장하나, RPC 자체가 신뢰경계 — 잘못된 호출은 조용히 CANCELLED로 적히지 않고 즉시 실패.
  IF p_refund_amount > v_order.paid_amount THEN
    RAISE EXCEPTION 'refund_amount % exceeds paid_amount %', p_refund_amount, v_order.paid_amount;
  END IF;

  FOR v_item IN
    SELECT product_option_id, quantity FROM order_items
    WHERE order_id = v_order.id AND product_option_id IS NOT NULL
  LOOP
    UPDATE product_options SET stock = stock + v_item.quantity
    WHERE id = v_item.product_option_id;
  END LOOP;

  IF v_order.point_used > 0 THEN
    UPDATE profiles SET point = point + v_order.point_used WHERE id = v_order.user_id;
    INSERT INTO point_histories (user_id, amount, reason, order_id)
    VALUES (v_order.user_id, v_order.point_used, '반품 환불', v_order.id);
  END IF;

  IF v_order.coupon_id IS NOT NULL THEN
    UPDATE user_coupons SET used_at = NULL, order_id = NULL
    WHERE order_id = v_order.id AND coupon_id = v_order.coupon_id;
  END IF;

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

  UPDATE payments
  SET status = CASE WHEN p_refund_amount < v_order.paid_amount
                    THEN 'PARTIAL_CANCELLED' ELSE 'CANCELLED' END
  WHERE order_id = v_order.id AND status IN ('DONE', 'PARTIAL_CANCELLED');

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
