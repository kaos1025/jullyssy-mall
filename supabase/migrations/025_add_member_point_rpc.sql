-- =============================================
-- 어드민 회원 포인트 지급/차감 RPC
-- 클라가 보낸 currentPoint를 신뢰하던 패턴을 원자적 UPDATE로 교체.
-- 두 어드민 동시 갱신 시 lost update + 클라 조작 가능성을 한 번에 차단.
-- =============================================

CREATE OR REPLACE FUNCTION add_member_point(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_point INT;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'amount는 0일 수 없습니다';
  END IF;

  -- 원자적 업데이트 + 새 잔액 반환
  UPDATE profiles
  SET point = point + p_amount
  WHERE id = p_user_id
  RETURNING point INTO v_new_point;

  IF v_new_point IS NULL THEN
    RAISE EXCEPTION '회원을 찾을 수 없습니다';
  END IF;

  -- 차감 결과가 음수면 함수 트랜잭션 롤백
  IF v_new_point < 0 THEN
    RAISE EXCEPTION '잔여 포인트가 부족합니다';
  END IF;

  INSERT INTO point_histories (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);

  RETURN jsonb_build_object('new_point', v_new_point);
END;
$$;
