# 인프라 구성 — VPS(앱 + self-hosted Supabase)

> 2026-10-11 Supabase 를 호스티드에서 VPS self-hosted(`jullyssy-cutover-*` 스택)로 이전.
> 2026-10-18 앱도 Vercel(Pro, 월 $20)에서 **같은 VPS 의 Docker 컨테이너**로 이전 (이 문서).
>
> Cloudflare Workers 를 검토했으나 제외 — `undici` ProxyAgent(네이버 API 고정 IP 경유), `unstable_cache`/`revalidateTag` 120곳,
> `@sentry/nextjs` 서버 SDK, 토스 웹훅의 CPU 10ms 리밋 리스크. VPS 는 코드 변경 없이 그대로 돈다.

## 아키텍처

```
[고객/관리자/토스 웹훅/pg_cron]
  ├─ https://jullyssy.shop            ┐
  ├─ https://www.jullyssy.shop  → 307 ┤ jullyssy-edge Caddy (호스트, 76.13.187.38:80/443)
  └─ https://api.jullyssy.shop        ┘   /etc/jullyssy-edge/Caddyfile
        │                                   ├─ jullyssy.shop     → 127.0.0.1:3001  (이 compose 의 app)
        │                                   └─ api.jullyssy.shop → 127.0.0.1:38080 (Supabase api-gw)
        ▼
┌────────────── VPS 76.13.187.38 (Hostinger KL, Ubuntu 24.04, 8GB) ──────────────┐
│ jullyssy-app        Next.js 14 standalone (node server.js), 127.0.0.1:3001      │
│ jullyssy-cutover-*  Supabase self-hosted (db / rest / auth / storage / imgproxy) │
│ supabase-*, pizza-edge   피자 프로젝트 — 건드리지 말 것                           │
│ senior-spot-work-*       별개 프로젝트 — 건드리지 말 것                           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- 앱은 Supabase 에 **공개 URL(`https://api.jullyssy.shop`)** 로 붙는다. compose 네트워크를 공유하지 않으므로 Supabase 스택 이름이 바뀌어도 앱 설정은 무관.
- 네이버 커머스 API 는 앱이 VPS 고정 IP 에서 직접 나간다 → `NAVER_PROXY_URL` 불필요 (비워두면 `lib/naver.ts` 가 직결).
- 크론(`/api/cron/*`)은 Supabase 의 pg_cron + pg_net 이 `https://jullyssy.shop/api/cron/...` 를 호출 — 도메인 기준이라 호스팅 이전과 무관.
- 토스 웹훅 URL 도 도메인 기준 — 변경 없음.

## 레포 안의 배포 파일

| 파일 | 역할 |
|------|------|
| `deploy/Dockerfile` | standalone 이미지. `.env.app` 을 BuildKit secret 으로 빌드 중에만 마운트 (이미지에 안 남음) |
| `deploy/docker-compose.app.yml` | `jullyssy-app` 서비스, `127.0.0.1:3001` 바인딩, 1GB 메모리 제한, 헬스체크 |
| `deploy/env.app.example` | 환경변수 템플릿 → VPS 에서 `deploy/.env.app` 으로 복사 (gitignore) |
| `.github/workflows/deploy.yml` | `main` push → SSH → `git reset --hard` → `compose up --build` → 헬스체크 |
| `next.config.mjs` | `output: "standalone"` 추가 |

## 최초 VPS 세팅 (1회)

```bash
# 0. (권장) swap 2GB — next build 가 2~3GB 를 쓴다. 현재 swap 0.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 1. 레포 클론
sudo mkdir -p /srv/jullyssy && sudo chown deploy:deploy /srv/jullyssy
git clone https://github.com/kaos1025/jullyssy-mall /srv/jullyssy/app
cd /srv/jullyssy/app

# 2. 환경변수 — Vercel 대시보드 Settings → Environment Variables (Production) 값을 옮긴다
cp deploy/env.app.example deploy/.env.app
chmod 600 deploy/.env.app
nano deploy/.env.app
#   ⚠️ VERCEL_ENV=production 은 반드시 유지 (CSRF/dev 라우트 게이트가 이 값을 본다 — 파일 주석 참고)
#   ⚠️ KV_REST_API_URL / TOKEN: Vercel Marketplace Upstash 는 Vercel 을 떠나면 사라진다.
#      https://console.upstash.com 에서 Redis DB 생성(무료, 리전 ap-southeast-1) → REST URL/Token 복사.
#   ⚠️ 토스 live 키 — validateEnv 가 test_ 접두사를 거부한다.

# 3. 첫 빌드·기동 (5~8분)
docker compose -f deploy/docker-compose.app.yml up -d --build
curl -s http://127.0.0.1:3001/robots.txt     # 200 이면 OK
docker logs -f jullyssy-app                  # validateEnv 에러 없는지

# 4. GitHub Actions 배포 키
ssh-keygen -t ed25519 -f ~/.ssh/jullyssy-deploy -N "" -C "github-actions-deploy"
cat ~/.ssh/jullyssy-deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/jullyssy-deploy                   # → GitHub Secrets VPS_SSH_KEY
#   GitHub repo → Settings → Secrets and variables → Actions:
#     VPS_HOST=76.13.187.38  VPS_USER=deploy  VPS_SSH_KEY=<위 개인키>  VPS_APP_DIR=/srv/jullyssy/app
```

## Caddy 사이트 블록 (jullyssy-edge)

`/etc/jullyssy-edge/Caddyfile` 에 추가. TLS 방식은 기존 `api.jullyssy.shop` 블록과 **동일하게** 맞춘다.

```caddyfile
# 앱 — www 는 apex 로 307 (Vercel 시절과 동일)
www.jullyssy.shop {
	redir https://jullyssy.shop{uri} 307
}

jullyssy.shop {
	encode gzip zstd
	reverse_proxy 127.0.0.1:3001 {
		header_up X-Forwarded-Proto {scheme}
	}
}
```

```bash
sudo /opt/jullyssy-edge/caddy-2.11.7/caddy validate --config /etc/jullyssy-edge/Caddyfile --adapter caddyfile
sudo systemctl reload jullyssy-edge     # 유닛 이름은 systemctl list-units | grep jullyssy 로 확인
```

## 컷오버 순서

1. **VPS 에서 사전 검증** (DNS 바꾸기 전)
   ```bash
   # 호스트 헤더로 Caddy 경유 테스트 — Cloudflare 를 거치지 않고 VPS 에 직접
   curl -skI https://76.13.187.38/ -H 'Host: jullyssy.shop'            # 200
   curl -skI https://76.13.187.38/products -H 'Host: jullyssy.shop'    # 200
   curl -sk  https://76.13.187.38/api/cron/gsc-sync -X POST -H 'Host: jullyssy.shop' -H "Authorization: Bearer $CRON_SECRET"
   ```
   로컬 PC `hosts` 에 `76.13.187.38 jullyssy.shop` 넣고 브라우저로 로그인 → 상품 → 장바구니 → 결제창까지 확인. 끝나면 hosts 원복.
2. **DNS 전환** — Cloudflare DNS: `jullyssy.shop` A → `76.13.187.38` (Proxied), `www` CNAME → `jullyssy.shop` (Proxied).
   SSL/TLS 모드는 `api.jullyssy.shop` 과 같은 값 유지. 반영은 수 초.
3. **확인** — `https://jullyssy.shop` 홈/상품/로그인/마이페이지/어드민, `curl -I https://www.jullyssy.shop` → 307.
   Sentry 에 `environment: production` 으로 이벤트 들어오는지. GitHub Actions 에서 `workflow_dispatch` 로 배포 1회 돌려 파이프라인 확인.
4. **하루 이틀 관찰** — `docker stats jullyssy-app` (메모리), `docker logs`, 주문·결제 1건 실거래 확인 (소액 상품 + 취소).
5. **Vercel 정리** — `jullyssy-mall` 프로젝트 삭제 → 팀 Pro 구독 해지. Vercel Marketplace Upstash 통합도 같이 사라지므로 **2번 전에 Upstash 직접 계정으로 전환돼 있어야 한다.**

### 롤백

DNS 를 Vercel 로 되돌린다 (A/CNAME 을 Vercel 값으로). Vercel 프로젝트는 5번 전까지 살아 있으므로 즉시 복구된다. 양쪽이 같은 Supabase 를 보므로 데이터 불일치는 없다.

## 운영

```bash
cd /srv/jullyssy/app
docker compose -f deploy/docker-compose.app.yml ps
docker logs -f --tail 100 jullyssy-app
docker stats jullyssy-app --no-stream

# 수동 재배포 (Actions 와 동일)
git pull && docker compose -f deploy/docker-compose.app.yml up -d --build

# 환경변수 변경 후 — NEXT_PUBLIC_* 는 빌드 인라인이라 재빌드 필요, 나머지는 재시작으로 충분
docker compose -f deploy/docker-compose.app.yml up -d --build      # NEXT_PUBLIC_* 바꿨을 때
docker compose -f deploy/docker-compose.app.yml up -d --force-recreate  # 그 외
```

- ISR/데이터 캐시(`.next/cache`)는 컨테이너 안 — 재배포마다 비워지고 첫 요청에 재생성. 홈 `revalidate=300`, 어드민 `revalidateTag` 는 단일 인스턴스라 그대로 동작.
- 이미지 최적화: `sharp` 추가됨 — standalone 에서 `next/image` 가 sharp 를 쓴다.
- 로그: json-file 20MB × 5 로테이션.

## Vercel 의존 코드 — 후속 정리 (별도 PR)

컷오버 PR 에서는 동작 보존을 위해 `VERCEL_ENV=production` 을 그대로 주입했다. 아래를 `APP_ENV` 하나로 통일하는 리팩토링은 안정화 후:

- `src/lib/env.ts` — KV/Resend 필수 검증, `isRealProduction`
- `src/lib/security/csrf.ts` — `isCsrfEnforced`, preview origin 패턴(`*.vercel.app` 은 이제 불필요)
- `src/app/api/dev/email-preview/route.ts` — production 404 게이트
- `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts` — `environment`
- `src/lib/email/send.ts` — env 태그
- `next.config.mjs` — `withSentryConfig` 의 `automaticVercelMonitors` (무해하지만 의미 없음)
