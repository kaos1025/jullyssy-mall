-- =============================================
-- approve_seo_draft RPC 확장 — v0.8 Track 1-C C-2
-- 028_approve_seo_draft.sql 의 CREATE OR REPLACE (시그니처 불변 → API 라우트 수정 불요).
--
-- 추가 동작:
--   - products.material  ← spec_metadata->>'material'  (소재)
--   - products.care_info ← spec_metadata->>'washCare'  (세탁)
--   COALESCE로 spec 값이 NULL이면 기존 값 유지 (preserve 모드는 spec_metadata=NULL → 무변경).
--
-- 충돌 가드 (§4.6): products.updated_at > draft.created_at 이면 (draft 생성 후 운영자가
--   상품을 수정한 것) → material/care_info sync skip (운영자 입력 우선).
--   meta_title/meta_description/search_tags/description 갱신은 기존과 동일하게 진행.
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
  v_product_updated_at TIMESTAMPTZ;
  v_sync_specs BOOLEAN;
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

  -- 충돌 가드: 제품 현재 updated_at 확인 (FOR UPDATE로 잠금).
  -- draft 생성 이후 운영자가 상품을 수정했으면 소재/세탁 sync는 skip (운영자 우선).
  SELECT updated_at INTO v_product_updated_at
  FROM products
  WHERE id = v_draft.product_id
  FOR UPDATE;

  v_sync_specs := (
    v_product_updated_at IS NULL
    OR v_product_updated_at <= v_draft.created_at
  );

  -- products 갱신
  UPDATE products SET
    meta_title       = v_draft.meta_title,
    meta_description = v_draft.meta_description,
    search_tags      = v_draft.search_tags,
    description      = p_processed_description,
    material         = CASE WHEN v_sync_specs
                            THEN COALESCE(v_draft.spec_metadata->>'material', material)
                            ELSE material END,
    care_info        = CASE WHEN v_sync_specs
                            THEN COALESCE(v_draft.spec_metadata->>'washCare', care_info)
                            ELSE care_info END,
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
