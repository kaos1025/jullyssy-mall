import { defineConfig } from "vitest/config"
import path from "path"

// 단위/통합 테스트(node 환경). 컴포넌트 테스트 도입 시 jsdom + @testing-library 추가.
// e2e(playwright .spec.ts)와 분리: include를 src/**/*.test.* 로 한정.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
