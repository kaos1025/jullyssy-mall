// 배너 이미지 orphan 일회성 정리 — dry-run 기본 / --apply 실삭제(비가역).
//
// 실행:
//   npx tsx scripts/cleanup-banner-orphans.ts           # 목록만 (dry-run, 기본)
//   npx tsx scripts/cleanup-banner-orphans.ts --apply    # 실삭제
//
// 로직: product-images 'banners/' 객체 ↔ hero_banners 참조(image_url 역산) 대조 → 미참조 = orphan.
// 안전: banners/ prefix 한정(상품 이미지 무관) + --apply 시 삭제 대상 목록을 먼저 출력 후 진행.
// secret 미출력: .env.local 의 var NAME만 사용, 값은 로그하지 않음 (fit-dryrun 패턴).

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { BANNERS_PREFIX, deriveBannerStoragePath } from "../src/lib/hero-banner-storage"

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
const APPLY = process.argv.includes("--apply")
const LIST_LIMIT = 1000

async function main() {
  // 1) banners/ 객체 목록 (list는 prefix 하위만 반환, name은 상대경로)
  const { data: objects, error: listErr } = await supabase.storage
    .from("product-images")
    .list(BANNERS_PREFIX.replace(/\/$/, ""), { limit: LIST_LIMIT })
  if (listErr) {
    console.error("storage list 실패:", listErr.message)
    process.exit(1)
  }
  const files = (objects ?? []).filter((o) => o.id !== null) // 디렉토리(id=null) 제외
  if (files.length >= LIST_LIMIT) {
    console.warn(`⚠️ list가 limit(${LIST_LIMIT}) 도달 — 일부 누락 가능. 페이지네이션 필요.`)
  }
  const storageKeys = files.map((o) => `${BANNERS_PREFIX}${o.name}`)

  // 2) hero_banners 참조 path 집합 (라우트와 동일한 역산 유틸 재사용)
  const { data: banners, error: bErr } = await supabase
    .from("hero_banners")
    .select("image_url_pc, image_url_mobile")
  if (bErr) {
    console.error("hero_banners 조회 실패:", bErr.message)
    process.exit(1)
  }
  const referenced = new Set<string>()
  for (const b of banners ?? []) {
    for (const u of [b.image_url_pc, b.image_url_mobile]) {
      const p = deriveBannerStoragePath(u as string | null)
      if (p) referenced.add(p)
    }
  }

  // 3) diff — banners/ 객체 중 어떤 배너도 참조하지 않는 것
  const orphans = storageKeys.filter((k) => !referenced.has(k))

  console.log(`=== 배너 orphan 정리 (${APPLY ? "APPLY" : "DRY-RUN"}) ===`)
  console.log(
    `banners/ 객체: ${storageKeys.length} / 참조됨: ${referenced.size} / orphan: ${orphans.length}`
  )

  if (orphans.length === 0) {
    console.log("정리할 orphan 없음.")
    return
  }

  console.log("orphan 목록:")
  for (const o of orphans) console.log("  -", o)

  if (!APPLY) {
    console.log(`\n[dry-run] 실삭제하려면 --apply 플래그를 붙이세요. (위 ${orphans.length}건)`)
    return
  }

  console.log(`\n[apply] 위 ${orphans.length}건 삭제를 진행합니다...`)
  const { data: removed, error: rmErr } = await supabase.storage
    .from("product-images")
    .remove(orphans)
  if (rmErr) {
    console.error("삭제 실패:", rmErr.message)
    process.exit(1)
  }
  console.log(`삭제 완료: ${removed?.length ?? 0}건`)
}

main()
