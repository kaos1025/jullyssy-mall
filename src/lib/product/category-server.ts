import type { createAdminClient } from "@/lib/supabase/admin"
import { isApparelCategory, type CategoryNode } from "./category"
import { parseFitType, type FitType } from "./fit-type"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * 상품 write 시 fit_type tri-state 결정 (FORM-NONAPPAREL-FIT-NULL-1 #2).
 * - category 존재 + 비의류 → null 강제 (비의류 fit 노이즈 차단)
 * - category 존재 + 의류    → parseFitType ?? REGULAR (의류 default)
 * - 무카테고리(unknown)      → parseFitType 보존 (null 무손상 — Track G 보존 정책 정렬)
 *
 * isApparel: buildApparelResolver가 반환한 판정 함수.
 */
export function resolveWriteFitType(
  categoryId: string | null,
  rawFit: unknown,
  isApparel: (categoryId: string | null | undefined) => boolean
): FitType | null {
  if (categoryId && !isApparel(categoryId)) return null // 존재 + 비의류
  if (categoryId) return parseFitType(rawFit) ?? "REGULAR" // 존재 + 의류
  return parseFitType(rawFit) // 무카테고리: 보존(null→null)
}

/**
 * categories 전체를 1회 조회해 id→의류판정 resolver를 반환한다.
 * leaf SSOT(isApparelCategory)를 상품 write 라우트(POST/PUT/PATCH)에서 재사용 —
 * 서버가 카테고리 기준으로 fit_type 비의류 NULL을 권위 결정한다(클라 신뢰 제거).
 *
 * import/refit-batch는 기존 인라인 해소 유지(FORM-NONAPPAREL-FIT-NULL-1 D-1: 신규 경로만 단일화).
 */
export async function buildApparelResolver(
  admin: AdminClient
): Promise<(categoryId: string | null | undefined) => boolean> {
  const { data: cats, error } = await admin
    .from("categories")
    .select("id, slug, parent_id")

  // fail-closed: 카테고리 조회 실패 시 throw (빈 맵 → 의류까지 비의류로 오판 → fit NULL 회귀 차단).
  // 라우트 try/catch가 500으로 처리 → write 미발생.
  if (error) {
    throw new Error(`카테고리 조회 실패(fit_type 판정 불가): ${error.message}`)
  }

  const catById = new Map<string, CategoryNode>()
  for (const c of cats ?? []) {
    catById.set(c.id, { slug: c.slug, parent_id: c.parent_id })
  }

  return (categoryId) => isApparelCategory(categoryId, catById)
}
