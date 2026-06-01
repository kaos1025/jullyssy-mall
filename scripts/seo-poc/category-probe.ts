// v0.8 Track 1-C — 카테고리 분류 probe (READ-ONLY). D5 "의류 카테고리 한정" 필터 기준 산출.
// 실행: npx tsx scripts/seo-poc/category-probe.ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

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
if (!url || !key) { console.error("env 누락"); process.exit(1) }
const supabase = createClient(url, key)

async function main() {
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, parent_id, slug")
    .order("sort_order")
  const catMap = new Map<string, { name: string; parent_id: string | null }>()
  for (const c of cats ?? []) catMap.set(c.id, { name: c.name, parent_id: c.parent_id })

  console.log("=== categories 전체 (계층) ===")
  for (const c of cats ?? []) {
    const parent = c.parent_id ? catMap.get(c.parent_id)?.name : null
    console.log(`${parent ? "  └ " : ""}${c.name}  [${c.id.slice(0, 8)}] slug=${c.slug ?? ""}${parent ? `  (parent=${parent})` : "  (TOP)"}`)
  }

  const { data: prods } = await supabase
    .from("products")
    .select("id, name, category_id, fit_type")
    .eq("status", "ACTIVE")
  const byCat = new Map<string, { count: number; samples: string[] }>()
  let noCat = 0
  for (const p of prods ?? []) {
    const cid = p.category_id ?? "__none__"
    if (cid === "__none__") noCat++
    if (!byCat.has(cid)) byCat.set(cid, { count: 0, samples: [] })
    const e = byCat.get(cid)!
    e.count++
    if (e.samples.length < 4) e.samples.push((p.name ?? "").slice(0, 28))
  }

  console.log("\n=== ACTIVE 상품 카테고리별 분포 ===")
  console.log("category_id NULL:", noCat)
  for (const [cid, e] of byCat) {
    if (cid === "__none__") continue
    const c = catMap.get(cid)
    const parent = c?.parent_id ? catMap.get(c.parent_id)?.name : null
    console.log(`${e.count}건  ${parent ? parent + " > " : ""}${c?.name ?? "?"}  [${cid.slice(0, 8)}]  예: ${e.samples.join(" / ")}`)
  }
}
main()
