---
name: review-cycle
description: 전체 품질 점검 사이클을 실행합니다. "리뷰 사이클", "review cycle", "품질 점검", "전체 검사", "커밋 전 검사" 등의 요청 시 자동 실행.
---

# 전체 품질 점검 사이클

lint → tsc → test → security → commit-ready 순서로 전체 코드 품질을 검증한다.
각 단계가 모두 통과해야 "Commit Ready" 판정을 내린다.

## 실행 절차

### Phase 1: Lint (코드 스타일)

```bash
npx next lint
```

- 0 errors → ✅ PASS
- errors 존재 → ❌ FAIL, 자동 수정 시도: `npx next lint --fix` 후 재검사

### Phase 2: Type Check (타입 안전성)

```bash
npx tsc --noEmit
```

- 0 errors → ✅ PASS
- errors 존재 → ❌ FAIL, 에러 목록 출력 후 수정 제안

### Phase 3: Test (테스트)

```bash
# vitest가 설치되어 있으면
npx vitest run 2>/dev/null

# 없으면 빌드로 대체 검증
npm run build
```

- 전체 통과 → ✅ PASS
- 실패 → ❌ FAIL, 실패한 테스트 목록 + 수정 제안

### Phase 4: Security (보안 점검)

```bash
# 1. 환경변수 하드코딩 검사
echo "=== Secret Scan ==="
grep -rn "sk_live\|sk_test\|service_role\|supabase_service\|TOSS_SECRET\|toss_sk" src/ --include="*.ts" --include="*.tsx" | grep -v "process\.env\|\.env" || echo "✅ No hardcoded secrets"

# 2. console.log 잔존 검사
echo "=== Console.log Scan ==="
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v ".test." || echo "✅ No stray console.log"

# 3. .env staged 검사
echo "=== .env Scan ==="
git diff --staged --name-only | grep -E "^\.env" && echo "🚨 .env STAGED!" || echo "✅ No .env staged"

# 4. Supabase 클라이언트 혼용 검사
echo "=== Supabase Client Misuse Scan ==="
grep -rn "supabase/admin" src/app/\(shop\)/ src/app/\(auth\)/ src/components/ --include="*.ts" --include="*.tsx" || echo "✅ No admin client in client code"
```

- 모든 항목 ✅ → PASS
- 1개라도 발견 → ❌ FAIL

### Phase 5: Commit-Ready 판정

## 결과 출력 형식

```
## 🔄 Review Cycle 결과

| Phase | 상태 | 비고 |
|-------|------|------|
| Lint | ✅/❌ | ESLint errors: N |
| Type Check | ✅/❌ | tsc errors: N |
| Test | ✅/❌ | passed/failed/skipped |
| Security | ✅/❌ | issues: N |

### 최종 판정: ✅ Commit Ready / ❌ Not Ready

[❌ 항목이 있으면 수정 필요 사항 목록]
```

## 판정 기준

- **4/4 PASS** → ✅ **Commit Ready** — 바로 커밋 가능
- **3/4 PASS** (Security만 FAIL) → ⚠️ **조건부 Ready** — 보안 이슈 수정 후 커밋
- **그 외** → ❌ **Not Ready** — 수정 필요
