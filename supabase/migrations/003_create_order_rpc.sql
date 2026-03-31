-- =============================================
-- 주문 생성 트랜잭션 RPC 함수
-- 재고 차감 → 쿠폰 → 포인트 → 주문 생성을 원자적으로 처리
-- =============================================

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_user_id UUID,
  p_items JSONB,
  p_address JSONB,
  p_coupon_id UUID DEFAULT NULL,
  p_point_used INT DEFAULT 0,
  p_shipping_fee INT DEFAULT 0
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
  v_paid_amount INT;
  v_item JSONB;
  v_affected_rows INT;
  v_coupon_type TEXT;
  v_discount_value INT;
  v_max_discount INT;
  v_min_order_amount INT;
  v_user_coupon_id UUID;
  v_current_point INT;
BEGIN
  -- 1. 주문번호 생성
  v_order_no := TO_CHAR(NOW(), 'YYYYMMDDHH24MISS') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- 2. 총 금액 계산
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
      c.type,
      c.discount_value,
      c.max_discount,
      c.min_order_amount
    INTO
      v_user_coupon_id,
      v_coupon_type,
      v_discount_value,
      v_max_discount,
      v_min_order_amount
    FROM user_coupons uc
    JOIN coupons c ON c.id = uc.coupon_id
    WHERE uc.id = p_coupon_id
      AND uc.user_id = p_user_id
      AND uc.used_at IS NULL
      AND c.is_active = TRUE
      AND c.starts_at <= NOW()
      AND c.expires_at > NOW();

    IF v_user_coupon_id IS NOT NULL AND (v_min_order_amount IS NULL OR v_total_amount >= v_min_order_amount) THEN
      IF v_coupon_type = 'FIXED' THEN
        v_discount_amount := v_discount_value;
      ELSIF v_coupon_type = 'PERCENT' THEN
        v_discount_amount := ROUND(v_total_amount * v_discount_value / 100.0)::INT;
        IF v_max_discount IS NOT NULL THEN
          v_discount_amount := LEAST(v_discount_amount, v_max_discount);
        END IF;
      END IF;
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

  -- 6. 최종 결제금액 계산
  v_paid_amount := v_total_amount - v_discount_amount - p_point_used + p_shipping_fee;

  IF v_paid_amount < 0 THEN
    RAISE EXCEPTION '결제 금액이 올바르지 않습니다';
  END IF;

  -- 7. 주문 생성
  INSERT INTO orders (
    user_id, order_no, status,
    total_amount, discount_amount, point_used, shipping_fee, paid_amount,
    recipient, recipient_phone, zipcode, address1, address2, delivery_memo
  ) VALUES (
    p_user_id, v_order_no, 'PENDING',
    v_total_amount, v_discount_amount, p_point_used, p_shipping_fee, v_paid_amount,
    p_address->>'recipient',
    p_address->>'phone',
    p_address->>'zipcode',
    p_address->>'address1',
    p_address->>'address2',
    p_address->>'memo'
  )
  RETURNING id INTO v_order_id;

  -- 8. 주문 상품 생성 (스냅샷)
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

  -- 9. 쿠폰 사용 처리
  IF p_coupon_id IS NOT NULL AND v_discount_amount > 0 THEN
    UPDATE user_coupons
    SET used_at = NOW(), order_id = v_order_id
    WHERE id = p_coupon_id
      AND user_id = p_user_id;
  END IF;

  -- 10. 포인트 차감
  IF p_point_used > 0 THEN
    UPDATE profiles
    SET point = point - p_point_used
    WHERE id = p_user_id;

    INSERT INTO point_histories (user_id, amount, reason, order_id)
    VALUES (p_user_id, -p_point_used, '주문 사용', v_order_id);
  END IF;

  -- 11. 결과 반환
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'paid_amount', v_paid_amount
  );
END;
$$;

-- =============================================
-- 재고 원복 헬퍼 함수 (결제 실패 시 사용)
-- =============================================

CREATE OR REPLACE FUNCTION restore_stock(
  p_option_id UUID,
  p_quantity INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_options
  SET stock = stock + p_quantity
  WHERE id = p_option_id;
END;
$$;
