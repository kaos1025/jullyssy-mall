-- order_items에 리뷰 작성 여부 플래그 추가
ALTER TABLE order_items ADD COLUMN is_reviewed BOOLEAN DEFAULT FALSE;

-- 기존 리뷰가 있는 항목 backfill
UPDATE order_items SET is_reviewed = TRUE
WHERE EXISTS (SELECT 1 FROM reviews WHERE reviews.order_item_id = order_items.id);
