# syntax=docker/dockerfile:1.7
# ============================================================
# 쥴리씨 자사몰 — Next.js standalone 이미지
# 빌드 컨텍스트: 레포 루트 (deploy/docker-compose.app.yml 참고)
#
# 환경변수 전달 방식:
#   next build 는 Vercel 과 똑같이 모든 env 를 봐야 한다 — NEXT_PUBLIC_* 는 번들에 인라인되고,
#   홈 페이지(ISR, revalidate=300) 는 빌드 시 프리렌더하면서 SUPABASE_SERVICE_ROLE_KEY 로 배너를 읽는다.
#   그래서 deploy/.env.app 전체를 BuildKit secret 으로 빌드 단계에만 마운트한다.
#   build arg 와 달리 이미지 레이어/history 에 남지 않는다. (요구: Docker 23+ BuildKit, compose v2)
# ============================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 레포에 public/ 이 없다 (favicon 등은 src/app 메타데이터 파일). 나중에 생겨도 아래 COPY 가 깨지지 않도록 보장.
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# .env.app 을 이 RUN 한 줄 동안만 /run/secrets/env_app 로 노출 → 셸에 export → next build
RUN --mount=type=secret,id=env_app,target=/run/secrets/env_app \
    sh -c 'set -a; . /run/secrets/env_app; set +a; npm run build'

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# standalone 출력물 + 정적 자산
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
# ISR/데이터 캐시(.next/cache)는 컨테이너 내부 — 재배포 시 초기화되며 첫 요청에 재생성된다.
CMD ["node", "server.js"]
