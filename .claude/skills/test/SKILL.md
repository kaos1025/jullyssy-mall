---
name: test
description: Next.js 14 자사몰 테스트 작성 및 실행. "테스트", "테스트 작성", "test", "테스트 돌려줘", "이거 테스트 해줘" 등의 요청 시 자동 실행.
---

# 쥴리씨 자사몰 테스트 자동화

## 테스트 환경 확인

먼저 테스트 도구가 설치되어 있는지 확인하라:

```bash
npx vitest --version 2>/dev/null || npx jest --version 2>/dev/null || echo "NO_TEST_RUNNER"
```

테스트 러너가 없으면 아래를 설치 제안:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

vitest 설정 파일이 없으면 생성:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

## 테스트 작성 규칙

### 파일 위치

테스트 파일은 소스 파일과 같은 디렉토리에 `.test.ts(x)` 확장자로 생성:

```
src/app/api/orders/route.ts
src/app/api/orders/route.test.ts     ← 여기

src/components/product/ProductCard.tsx
src/components/product/ProductCard.test.tsx  ← 여기

src/hooks/use-cart.ts
src/hooks/use-cart.test.ts           ← 여기
```

### 테스트 분류

| 종류 | 대상 | 우선순위 |
|------|------|----------|
| **API Route 테스트** | `src/app/api/**` | 🔴 최우선 |
| **비즈니스 로직 테스트** | `src/hooks/`, `src/lib/` | 🔴 최우선 |
| **컴포넌트 테스트** | `src/components/**` | 🟡 중요 |
| **페이지 테스트** | `src/app/**/(page).tsx` | 🟢 선택 |

### API Route 테스트 패턴

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}))

describe('POST /api/orders', () => {
  it('인증되지 않은 요청은 401을 반환한다', async () => {})
  it('재고 부족 시 400을 반환한다', async () => {})
  it('정상 주문 시 스냅샷이 저장된다', async () => {})
  it('금액은 정수(원 단위)로 저장된다', async () => {})
})
```

### Hook 테스트 패턴

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCartStore } from './use-cart'

describe('useCartStore', () => {
  beforeEach(() => { useCartStore.getState().clearCart() })
  it('상품을 추가하면 cart에 반영된다', () => {})
  it('같은 옵션의 상품을 추가하면 수량이 증가한다', () => {})
  it('총 금액이 정확히 계산된다', () => {})
})
```

## 테스트 실행

```bash
npx vitest run                                    # 전체
npx vitest run src/app/api/orders/route.test.ts   # 특정 파일
npx vitest                                        # watch
npx vitest run --coverage                         # 커버리지
```

## 주의사항

- Supabase는 항상 **모킹** (실제 DB 연결 금지)
- 토스페이먼츠 API 호출도 반드시 **모킹**
- 환경변수는 `vi.stubEnv()` 사용
- 금액 관련 테스트는 **경계값**(0원, 최대 금액, 할인 후 0원 이하) 반드시 포함
