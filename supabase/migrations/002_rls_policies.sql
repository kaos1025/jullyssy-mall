-- =============================================
-- RLS 정책
-- =============================================

-- 모든 테이블 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE naver_sync_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- profiles: 본인 조회/수정만
-- =============================================
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- addresses: 본인 CRUD
-- =============================================
CREATE POLICY "addresses_select_own" ON addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "addresses_insert_own" ON addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "addresses_update_own" ON addresses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "addresses_delete_own" ON addresses
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- categories: 누구나 조회
-- =============================================
CREATE POLICY "categories_select_all" ON categories
  FOR SELECT USING (true);

-- =============================================
-- products: 누구나 조회
-- =============================================
CREATE POLICY "products_select_all" ON products
  FOR SELECT USING (true);

-- =============================================
-- product_images: 누구나 조회
-- =============================================
CREATE POLICY "product_images_select_all" ON product_images
  FOR SELECT USING (true);

-- =============================================
-- product_options: 누구나 조회
-- =============================================
CREATE POLICY "product_options_select_all" ON product_options
  FOR SELECT USING (true);

-- =============================================
-- orders: 본인 조회만
-- =============================================
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- order_items: 본인 주문의 아이템만 조회
-- =============================================
CREATE POLICY "order_items_select_own" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

-- =============================================
-- payments: 본인 주문의 결제만 조회
-- =============================================
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
    )
  );

-- =============================================
-- coupons: 활성 쿠폰 누구나 조회
-- =============================================
CREATE POLICY "coupons_select_active" ON coupons
  FOR SELECT USING (is_active = true);

-- =============================================
-- user_coupons: 본인 조회만
-- =============================================
CREATE POLICY "user_coupons_select_own" ON user_coupons
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- point_histories: 본인 조회만
-- =============================================
CREATE POLICY "point_histories_select_own" ON point_histories
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- reviews: 누구나 조회, 본인만 작성
-- =============================================
CREATE POLICY "reviews_select_all" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- review_images: 누구나 조회
-- =============================================
CREATE POLICY "review_images_select_all" ON review_images
  FOR SELECT USING (true);
