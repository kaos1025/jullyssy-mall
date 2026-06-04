// v0.8 마무리 M-1 — spec_metadata.material/washCare → products backfill 후보 산출 + 적용.
// 후보: products.material 빈 ACTIVE 상품 × draft material 보유. 상품별 최신 non-empty
//   (approved draft 우선 → 없으면 최신 created_at). washCare → care_info.
// fill-where-null (운영자 SSOT 우선). updated_at 미bump (C-2 충돌가드 오염 방지 — B-4 학습).

import { createAdminClient } from "@/lib/supabase/admin"

export interface MaterialCandidate {
  product_id: string
  name: string
  material: string
  wash_care: string | null
  source: "approved" | "unreviewed"
  cur_care: string | null
}

interface DraftJoinRow {
  product_id: string
  status: string
  created_at: string
  spec_metadata: { material?: string; washCare?: string } | null
  products: {
    name: string
    status: string
    material: string | null
    care_info: string | null
  } | null
}

export async function getMaterialBackfillCandidates(): Promise<MaterialCandidate[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("seo_metadata_drafts")
    .select(
      "product_id, status, created_at, spec_metadata, products!inner(name, status, material, care_info)",
    )
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as DraftJoinRow[]

  // 상품별 최적 draft (approved 우선 → 최신 created_at), material 빈 ACTIVE 상품만
  const best = new Map<string, DraftJoinRow>()
  for (const r of rows) {
    const mat = r.spec_metadata?.material?.trim()
    if (!mat) continue
    if (!r.products || r.products.status !== "ACTIVE") continue
    if (r.products.material) continue // fill-where-null: 이미 보유 skip
    const cur = best.get(r.product_id)
    if (!cur) {
      best.set(r.product_id, r)
      continue
    }
    const rApproved = r.status === "approved"
    const cApproved = cur.status === "approved"
    if (rApproved !== cApproved) {
      if (rApproved) best.set(r.product_id, r)
    } else if (r.created_at > cur.created_at) {
      best.set(r.product_id, r)
    }
  }

  const out: MaterialCandidate[] = []
  for (const r of Array.from(best.values())) {
    out.push({
      product_id: r.product_id,
      name: r.products?.name ?? "",
      material: (r.spec_metadata?.material ?? "").trim(),
      wash_care: r.spec_metadata?.washCare?.trim() || null,
      source: r.status === "approved" ? "approved" : "unreviewed",
      cur_care: r.products?.care_info ?? null,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export interface MaterialBackfillResult {
  applied: number
  requested: number
  failed: { product_id: string; error: string }[]
}

export async function applyMaterialBackfill(
  productIds: string[] | null,
): Promise<MaterialBackfillResult> {
  const admin = createAdminClient()
  const candidates = await getMaterialBackfillCandidates()
  const selected = productIds ? new Set(productIds) : null
  const targets = selected
    ? candidates.filter((c) => selected.has(c.product_id))
    : candidates

  let applied = 0
  const failed: { product_id: string; error: string }[] = []
  for (const c of targets) {
    const patch: { material: string; care_info?: string } = { material: c.material }
    if (c.wash_care && !c.cur_care) patch.care_info = c.wash_care
    // fill-where-null 재확인(.is material null) + updated_at 미설정(미bump)
    const { error } = await admin
      .from("products")
      .update(patch)
      .eq("id", c.product_id)
      .is("material", null)
    if (error) failed.push({ product_id: c.product_id, error: error.message })
    else applied++
  }
  return { applied, requested: targets.length, failed }
}
