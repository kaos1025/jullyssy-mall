// v0.8 Track 1-C Phase 0 #7 — fit_type 자동 재매핑 dry-run (READ-ONLY, write 없음).
//
// 실행: npx tsx scripts/seo-poc/fit-dryrun.ts
//
// 목적: ACTIVE 상품의 description / search_tags 에 import Layer 1.5(sellerTags)
//   + Layer 2(description) 추출 로직을 적용해, fit_type=REGULAR 로 박혀 있는 건 중
//   실제 핏이 추출되는 비율(D5 자동 재매핑 임계 판단)을 산출.
// 부가: #4 search_tags 보유 건의 출처(naver import 여부) 추정.
//
// secret 미출력: .env.local 의 KEY=VALUE 중 필요한 var NAME만 사용, 값은 로그 금지.

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  extractFitFromDescription,
  extractFitFromTags,
} from "../../src/lib/seo/description-parser"
import { FIT_TYPE_VALUES } from "../../src/lib/product/fit-type"

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch (e) {
    console.error(".env.local 읽기 실패:", (e as Error).message)
  }
  return out
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("env 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, key)

const emptyDist = (): Record<string, number> => {
  const d: Record<string, number> = { __null__: 0 }
  for (const v of FIT_TYPE_VALUES) d[v] = 0
  return d
}

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, fit_type, search_tags, naver_product_no, category_id, created_at")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
  if (error) {
    console.error("query error:", error.message)
    process.exit(1)
  }
  const rows = data ?? []

  // 의류 카테고리 판별 (refit-batch route와 동일 기준: top/bottom/outer/dress)
  const APPAREL_TOP = ["top", "bottom", "outer", "dress"]
  const { data: cats } = await supabase
    .from("categories")
    .select("id, slug, parent_id")
  const cmap = new Map<string, { slug: string | null; parent_id: string | null }>()
  for (const c of cats ?? []) cmap.set(c.id, { slug: c.slug, parent_id: c.parent_id })
  const isApparel = (cid: string | null): boolean => {
    if (!cid) return false
    const c = cmap.get(cid)
    if (!c) return false
    const top = c.parent_id ? cmap.get(c.parent_id)?.slug : c.slug
    return !!top && APPAREL_TOP.includes(top)
  }

  const descDist = emptyDist()
  const tagsDist = emptyDist()
  const combinedDist = emptyDist()
  let regularRows = 0
  let wouldChange = 0 // REGULAR 인데 combined(tags||desc) 가 non-null & != REGULAR
  let apparelWouldChange = 0 // 위 + 의류 카테고리 한정 (refit-batch 실제 대상)
  const changeSamples: { name: string; via: string; to: string }[] = []

  for (const r of rows) {
    if (r.fit_type === "REGULAR") regularRows++

    const tagsArr = Array.isArray(r.search_tags) ? (r.search_tags as string[]) : []
    const exTags = extractFitFromTags(tagsArr)
    const exDesc = extractFitFromDescription(r.description)
    const combined = exTags ?? exDesc // import Layer 순서 1.5 → 2

    if (exTags === null) tagsDist.__null__++
    else tagsDist[exTags]++
    if (exDesc === null) descDist.__null__++
    else descDist[exDesc]++
    if (combined === null) combinedDist.__null__++
    else combinedDist[combined]++

    if (r.fit_type === "REGULAR" && combined !== null && combined !== "REGULAR") {
      wouldChange++
      if (isApparel(r.category_id)) apparelWouldChange++
      if (changeSamples.length < 15) {
        changeSamples.push({
          name: (r.name ?? "").slice(0, 30),
          via: exTags ? "tags" : "desc",
          to: combined,
        })
      }
    }
  }

  console.log("=== Track 1-C Phase 0 #7 dry-run (READ-ONLY) ===")
  console.log("ACTIVE 총건:", rows.length)
  console.log("fit_type=REGULAR 건:", regularRows)
  console.log("Layer1.5 tags 추출 분포 :", JSON.stringify(tagsDist))
  console.log("Layer2 desc 추출 분포   :", JSON.stringify(descDist))
  console.log("combined(tags||desc)분포:", JSON.stringify(combinedDist))
  const rate = rows.length ? (wouldChange / rows.length) * 100 : 0
  console.log(
    `\n>>> 자동 재매핑 시 REGULAR→non-REGULAR 변경 가능: ${wouldChange}건 / ACTIVE ${rows.length} = ${rate.toFixed(1)}%`
  )
  console.log(
    `>>> [refit-batch 의류 한정] 실제 변경 예정: ${apparelWouldChange}건 (비의류/미분류 제외 ${wouldChange - apparelWouldChange}건)`
  )
  console.log("변경 샘플:", JSON.stringify(changeSamples))

  const withTags = rows.filter(
    (r) => Array.isArray(r.search_tags) && (r.search_tags as string[]).length > 0
  )
  console.log("\n=== #4 search_tags 보유(ACTIVE) 출처 추정 ===")
  console.log("보유 건수:", withTags.length)
  console.log(
    "naver_product_no 보유:",
    withTags.filter((r) => r.naver_product_no).length,
    "/",
    withTags.length
  )
  console.log(
    "샘플:",
    JSON.stringify(
      withTags.slice(0, 12).map((r) => ({
        name: (r.name ?? "").slice(0, 24),
        tags: r.search_tags,
        naver: !!r.naver_product_no,
      }))
    )
  )
}

main()
