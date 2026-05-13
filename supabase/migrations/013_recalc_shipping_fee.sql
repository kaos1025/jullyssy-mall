-- =============================================
-- 주문 생성 RPC: 배송비 서버측 재계산 (overload 추가)
-- - 신 시그니처 추가: p_free_shipping_threshold + p_standard_shipping_fee
-- - 구 시그니처(p_shipping_fee 받는 형태)는 본 마이그레이션에서 DROP하지 않음 →
--   배포 윈도우 0초 (구 코드와 신 코드가 잠시 공존해도 각자 자기 시그니처로 dispatch)
-- - Postgres 함수 overload 메커니즘:
--   * 구: (UUID, JSONB, JSONB, UUID, INT, INT) — 이름에 p_shipping_fee 포함
--   * 신: (UUID, JSONB, JSONB, INT, INT, UUID, INT) — 이름에 p_free_shipping_threshold/p_standard_shipping_fee 포함
--   서로 다른 arity + 서로 다른 positional types → 별개 overload로 공존
--   named-arg 호출 시 unique한 파라미터 이름 기준으로 dispatch 됨
-- - 신 코드(api/orders/route.ts)는 신 시그니처 호출 → 클라 shipping_fee 신뢰 제거 달성
-- - 구 시그니처는 1주일 후 별도 마이그레이션(014)으로 DROP 예정 (배포 안정화 확인 후)
-- =============================================

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_user_id UUID,
  p_items JSONB,
  p_address JSONB,
  p_free_shipping_threshold INT,
  p_standard_shipping_fee INT,
  p_coupon_id UUID DEFAULT NULL,
  p_point_used INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_order_no TEXT;
  v_total_amount INT := 0;
  v_discount_amount INT := 0;
  v_shipping_fee INT;
  v_paid_amount INT;
  v_item JSONB;
  v_affected_rows INT;
  v_has_free_shipping BOOLEAN;
  v_coupon_type TEXT;
  v_coupon_value INT;
  v_max_discount INT;
  v_min_order_price INT;
  v_user_coupon_id UUID;
  v_coupon_ref_id UUID;
  v_current_point INT;
BEGIN
  -- 1. 주문번호 생성
  v_order_no := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- 2. 총 금액 계산 (price는 클라이언트에서 sale_price+extra_price로 전달됨)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'price')::INT * (v_item->>'quantity')::INT);
  END LOOP;

  -- 3. 재고 차감 (원자적)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE product_options
    SET stock = stock - (v_item->>'quantity')::INT
    WHERE id = (v_item->>'product_option_id')::UUID
      AND stock >= (v_item->>'quantity')::INT;

    GET DIAGNOSTICS v_affected_rows = ROW_COUNT;

    IF v_affected_rows = 0 THEN
      RAISE EXCEPTION '재고가 부족합니다: % (%/%)',
        v_item->>'product_name', v_item->>'color', v_item->>'size';
    END IF;
  END LOOP;

  -- 4. 쿠폰 할인 계산
  IF p_coupon_id IS NOT NULL THEN
    SELECT
      uc.id,
      c.id,
      c.type,
      c.value,
      c.max_discount,
      c.min_order_price
    INTO
      v_user_coupon_id,
      v_coupon_ref_id,
      v_coupon_type,
      v_coupon_value,
      v_max_discount,
      v_min_order_price
    FROM user_coupons uc
    JOIN coupons c ON c.id = uc.coupon_id
    WHERE uc.id = p_coupon_id
      AND uc.user_id = p_user_id
      AND uc.used_at IS NULL
      AND c.is_active = TRUE
      AND c.starts_at <= NOW()
      AND (c.expires_at IS NULL OR c.expires_at > NOW());

    IF v_user_coupon_id IS NOT NULL AND (v_min_order_price IS NULL OR v_min_order_price = 0 OR v_total_amount >= v_min_order_price) THEN
      IF v_coupon_type = 'FIXED' THEN
        v_discount_amount := v_coupon_value;
      ELSIF v_coupon_type = 'PERCENT' THEN
        v_discount_amount := ROUND(v_total_amount * v_coupon_value / 100.0)::INT;
        IF v_max_discount IS NOT NULL THEN
          v_discount_amount := LEAST(v_discount_amount, v_max_discount);
        END IF;
      END IF;
      -- 주문금액 초과 방지
      v_discount_amount := LEAST(v_discount_amount, v_total_amount);
    END IF;
  END IF;

  -- 5. 포인트 검증
  IF p_point_used > 0 THEN
    SELECT point INTO v_current_point
    FROM profiles
    WHERE id = p_user_id;

    IF v_current_point IS NULL OR v_current_point < p_point_used THEN
      RAISE EXCEPTION '포인트가 부족합니다';
    END IF;
  END IF;

  -- 6. 배송비 서버측 재계산 (클라 신뢰 제거 — Track 2 보안 fix)
  --    ANY product.free_shipping = true 또는 총액 >= 임계값 → 무료배송
  SELECT COALESCE(bool_or(p.free_shipping), false)
  INTO v_has_free_shipping
  FROM jsonb_array_elements(p_items) AS i
  JOIN products p ON p.id = (i->>'product_id')::UUID;

  IF v_has_free_shipping OR v_total_amount >= p_free_shipping_threshold THEN
    v_shipping_fee := 0;
  ELSE
    v_shipping_fee := p_standard_shipping_fee;
  END IF;

  -- 7. 최종 결제금액 계산
  v_paid_amount := v_total_amount - v_discount_amount - p_point_used + v_shipping_fee;

  IF v_paid_amount < 0 THEN
    RAISE EXCEPTION '결제 금액이 올바르지 않습니다';
  END IF;

  -- 8. 주문 생성
  INSERT INTO orders (
    user_id, order_no, status,
    total_amount, discount_amount, point_used, shipping_fee, paid_amount,
    coupon_id,
    recipient, recipient_phone, zipcode, address1, address2, delivery_memo
  ) VALUES (
    p_user_id, v_order_no, 'PENDING',
    v_total_amount, v_discount_amount, p_point_used, v_shipping_fee, v_paid_amount,
    v_coupon_ref_id,
    p_address->>'recipient',
    p_address->>'phone',
    p_address->>'zipcode',
    p_address->>'address1',
    p_address->>'address2',
    p_address->>'memo'
  )
  RETURNING id INTO v_order_id;

  -- 9. 주문 상품 생성 (스냅샷)
  INSERT INTO order_items (order_id, product_id, product_option_id, product_name, product_image, color, size, price, quantity)
  SELECT
    v_order_id,
    (item->>'product_id')::UUID,
    (item->>'product_option_id')::UUID,
    item->>'product_name',
    item->>'product_image',
    item->>'color',
    item->>'size',
    (item->>'price')::INT,
    (item->>'quantity')::INT
  FROM jsonb_array_elements(p_items) AS item;

  -- 10. 쿠폰 사용 처리
  IF p_coupon_id IS NOT NULL AND v_discount_amount > 0 THEN
    UPDATE user_coupons
    SET used_at = NOW(), order_id = v_order_id
    WHERE id = p_coupon_id
      AND user_id = p_user_id;
  END IF;

  -- 11. 포인트 차감
  IF p_point_used > 0 THEN
    UPDATE profiles
    SET point = point - p_point_used
    WHERE id = p_user_id;

    INSERT INTO point_histories (user_id, amount, reason, order_id)
    VALUES (p_user_id, -p_point_used, '주문 사용', v_order_id);
  END IF;

  -- 12. 결과 반환
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'paid_amount', v_paid_amount
  );
END;
$$;
