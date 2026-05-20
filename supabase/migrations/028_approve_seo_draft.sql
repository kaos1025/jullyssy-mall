-- =============================================
-- SEO draft 승인 RPC — Phase 2 (#48-1)
-- approve 라우트의 트랜잭션 보장 (PR #23 머지 후 Phase 2 산출).
--
-- API가 미리 계산해서 전달:
--   - p_processed_description: ensureImgAlts(description, [], {}) 결과 (NULL 가능)
--   - p_pattern_alts: 4번째+ 이미지 alt JSONB [{image_id, alt_text}]
--
-- 함수가 직접 수행:
--   - draft pending_review status 검증 (race 방지)
--   - products: meta_title/meta_description/search_tags/description/seo_updated_at
--   - product_images 상위 3장: draft.image_alt_texts 적용 (sort_order asc 기준)
--   - product_images 4번째+: p_pattern_alts 적용 (image_id로 직접 매칭)
--   - draft: status='approved' + reviewed_by + reviewed_at + review_note
--
-- SECURITY DEFINER + service_role 전용 grant. admin email whitelist는 API에서 verifyAdmin.
-- =============================================

CREATE OR REPLACE FUNCTION approve_seo_draft(
  p_draft_id UUID,
  p_processed_description TEXT,
  p_pattern_alts JSONB,
  p_reviewer_id UUID,
  p_review_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft seo_metadata_drafts%ROWTYPE;
  v_image_alts JSONB;
  v_alt JSONB;
  v_img_id UUID;
BEGIN
  -- draft 조회 + 상태 검증 (FOR UPDATE로 race 차단)
  SELECT * INTO v_draft
  FROM seo_metadata_drafts
  WHERE id = p_draft_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRAFT_NOT_FOUND';
  END IF;
  IF v_draft.status <> 'pending_review' THEN
    RAISE EXCEPTION 'DRAFT_STATUS_INVALID: %', v_draft.status;
  END IF;

  -- products 갱신
  UPDATE products SET
    meta_title       = v_draft.meta_title,
    meta_description = v_draft.meta_description,
    search_tags      = v_draft.search_tags,
    description      = p_processed_description,
    seo_updated_at   = NOW(),
    updated_at       = NOW()
  WHERE id = v_draft.product_id;

  -- product_images 상위 3장: draft.image_alt_texts 적용
  -- image_index (0/1/2) → sort_order asc N번째 row
  v_image_alts := v_draft.image_alt_texts;
  IF v_image_alts IS NOT NULL AND jsonb_typeof(v_image_alts) = 'array' THEN
    FOR v_alt IN SELECT * FROM jsonb_array_elements(v_image_alts) LOOP
      WITH ordered_imgs AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, 0), created_at) - 1 AS idx
        FROM product_images
        WHERE product_id = v_draft.product_id
      )
      UPDATE product_images SET alt_text = v_alt->>'alt_text'
      WHERE id = (
        SELECT id FROM ordered_imgs
        WHERE idx = (v_alt->>'image_index')::INT
      );
    END LOOP;
  END IF;

  -- product_images 4번째+: p_pattern_alts 적용 (image_id 직접 매칭)
  IF p_pattern_alts IS NOT NULL AND jsonb_typeof(p_pattern_alts) = 'array' THEN
    FOR v_alt IN SELECT * FROM jsonb_array_elements(p_pattern_alts) LOOP
      v_img_id := (v_alt->>'image_id')::UUID;
      UPDATE product_images SET alt_text = v_alt->>'alt_text'
      WHERE id = v_img_id AND product_id = v_draft.product_id;
    END LOOP;
  END IF;

  -- draft 갱신
  UPDATE seo_metadata_drafts SET
    status      = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_note = p_review_note,
    updated_at  = NOW()
  WHERE id = p_draft_id;
END;
$$;

REVOKE ALL ON FUNCTION approve_seo_draft FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_seo_draft(UUID, TEXT, JSONB, UUID, TEXT) TO service_role;
