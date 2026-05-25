-- =============================================
-- handle_new_user 트리거 확장: WELCOME5000 자동 발급
-- =============================================
-- 기존 동작 (009 기준): profiles INSERT (id, email, name, phone, marketing_agreed)
-- 추가 동작: code='WELCOME5000' AND is_active 쿠폰 자동 발급
--   - 멱등: UNIQUE(user_id, coupon_id) + ON CONFLICT DO NOTHING
--   - 동기화: 실제 INSERT 발생 시에만 coupons.issued_count += 1 (CTE + EXISTS)
--   - 실패 격리: 쿠폰 발급 실패가 회원가입을 막지 않도록 EXCEPTION block
--   - 보안: SECURITY DEFINER + SET search_path (009 미설정분 정합)
--
-- 유효기간 모델: coupons.expires_at 단일 SSOT (옵션 B). user_coupons는 스키마 변경 없음.
-- 트리거 부착(auth.users AFTER INSERT)은 001에서 유지. 재부착 없음.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  welcome_coupon_id uuid;
BEGIN
  -- 기존 profiles INSERT (009 컬럼 매핑 유지 — full_name fallback은 카카오 OAuth 호환)
  INSERT INTO public.profiles (id, email, name, phone, marketing_agreed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE((NEW.raw_user_meta_data->>'marketing_agreed')::boolean, false)
  );

  -- WELCOME5000 자동 발급 (실패는 회원가입에 cascading 금지)
  BEGIN
    SELECT id INTO welcome_coupon_id
    FROM public.coupons
    WHERE code = 'WELCOME5000'
      AND is_active = true
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    IF welcome_coupon_id IS NOT NULL THEN
      WITH inserted AS (
        INSERT INTO public.user_coupons (user_id, coupon_id)
        VALUES (NEW.id, welcome_coupon_id)
        ON CONFLICT (user_id, coupon_id) DO NOTHING
        RETURNING id
      )
      UPDATE public.coupons
      SET issued_count = COALESCE(issued_count, 0) + 1
      WHERE id = welcome_coupon_id
        AND EXISTS (SELECT 1 FROM inserted);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Welcome coupon issuance failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
