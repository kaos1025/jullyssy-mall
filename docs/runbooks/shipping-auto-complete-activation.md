# 배송 자동완료 (P1-3-A) 라이브 활성화 절차서

> 대상: 운영자 / 작성 근거: PR #63 (`12d35a5`) 머지 후 cron 활성화
> 핵심 안전 제약: **044(스케줄링)는 반드시 마지막.** 수동 1회 검증 → 정상 확인 → 그제서야 스케줄 ON.

---

## 0. 현재 상태 (머지 직후)

- ✅ 코드 머지: `markOrderDelivered` SSOT, `/api/cron/shipping-poll` 라우트, 어댑터, 어드민 badge.
- ✅ 마이그 043 적용 완료: `orders.delivered_at / shipped_at / delivered_via` + 부분인덱스.
- ⏸️ **cron dormant**: 044 미적용 → 정기 스케줄 없음. env/vault 없음 → 라우트 수동 호출도 401.
- ➡️ 즉, **지금은 자동 전환이 일어나지 않는다.** 아래 순서로 통제하며 켠다.

### ⚠️ 왜 044가 마지막인가
044를 먼저 적용하면 **첫 스케줄 tick이 검증 전에 전체 SHIPPING 주문을 자동 전환**한다. 파싱 버그가 있으면 그 순간 실 주문 오전환 + 고객에게 잘못된 배송완료 메일이 나간다(**이메일은 회수 불가**). 수동 1회 → 관찰 → 스케줄 순서면 그 창이 닫힌다.

---

## 사전 준비물
- `SWEET_TRACKER_API_KEY` (발급 완료분)
- `CRON_SECRET` 값 1개 생성 (랜덤 32자+; 예: `openssl rand -hex 32`)
- 검증용 실 송장 2건: **(A) 이미 배송완료된 송장** 1건, **(B) 배송중 송장** 1건 (courier+invoice). 양성/음성 모두 확인용.
- 운영 도메인 = `NEXT_PUBLIC_SITE_URL` 값 (이하 `<PROD_DOMAIN>`)
- Supabase project: `mdtvnbyvhzhbksssyzgl`

---

## 활성화 5단계

### 1단계 — Secrets 주입 + 재배포
1. **Vercel env (Production)** 추가: `SWEET_TRACKER_API_KEY`, `CRON_SECRET`.
2. **Supabase vault** 등록 (대시보드 SQL 또는 MCP):
   ```sql
   select vault.create_secret('Bearer <CRON_SECRET와 동일한 값>', 'shipping_poll_auth');
   ```
3. **Production 재배포 1회** (Vercel env는 다음 배포부터 적용됨).

**합격 기준**
- 재배포 완료.
- 잘못된/빈 Bearer로 호출 시 401:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -X POST "https://<PROD_DOMAIN>/api/cron/shipping-poll" -H "Authorization: Bearer WRONG"
  # → 401
  ```

---

### 2단계 — 어댑터 실 키 1콜 (격리 파싱 검증)
Sweet Tracker를 직접 호출해 키 유효성 + 응답 파싱 + 코드맵을 확인한다. (코드: 01 우체국 / 04 CJ / 05 한진 / 08 롯데)

```bash
# (A) 배송완료 송장
curl "https://info.sweettracker.co.kr/api/v1/trackingInfo?t_key=<KEY>&t_code=04&t_invoice=<배송완료_INVOICE>"
# (B) 배송중 송장
curl "https://info.sweettracker.co.kr/api/v1/trackingInfo?t_key=<KEY>&t_code=04&t_invoice=<배송중_INVOICE>"
```

**합격 기준**
- (A): `completeYN":"Y"` (또는 `level":6`) + `lastDetail.timeString` 존재 → 어댑터가 `delivered=true`로 판정할 입력.
- (B): `completeYN":"N"` 및 `level` < 6 → `delivered=false`.
- 에러 응답(`status:false`/`code`)이면 키/코드/송장 점검 후 재시도. **여기서 막히면 3단계로 진행 금지.**

---

### 3-pre단계 — dryRun 전건 프리뷰 (필수 게이트 · 0 고객영향)
스케줄·전환·메일 없이 현재 SHIPPING **전건**의 판정을 미리 본다. step 2는 운영자가 고른 2건 샘플만 검증하지만 실 invoke(3단계)는 전건을 친다 — step 2가 못 본 택배사/응답 변형이 전건엔 섞일 수 있고, 거기서 오판정이 나면 **불가역 오발송**(잘못된 배송완료 메일)이 된다. 그래서 전건 무영향 프리뷰가 실 invoke의 **필수 선행 게이트**다. (배포 후 상시 디버그 도구로도 사용 — 언제든 현재 판정 재확인.)

```bash
curl -X POST "https://<PROD_DOMAIN>/api/cron/shipping-poll?dryRun=1" -H "Authorization: Bearer <CRON_SECRET>"
# {"ok":true,"dryRun":true,"polled":7,
#  "wouldTransition":[{"id":"...","courier":"CJ대한통운","deliveredAt":"2026-..."}],
#  "skipped":4,"unsupported":1,"failed":0}
```

**합격 기준 (전부 충족해야 3단계 진행)**
- `failed = 0` (>0이면 Sentry `shipping.auto_complete` 확인 → 원인 수정 후 재실행)
- `wouldTransition` **전건을 실제 배송완료 여부와 수기 대조 → 전부 일치(오판정 0)**. 1건이라도 실제 미배송이면 실 invoke 금지, 어댑터 판정 점검.
- `unsupported`/`skipped` 분포가 상식적인지 확인.
- dryRun은 DB·메일을 전혀 건드리지 않으므로 몇 번이든 반복 가능.

---

### 3단계 — 실 invoke 1회 (= 실 송장 e2e · 3-pre 통과 후 고신뢰)
3-pre가 깨끗할 때만. 스케줄을 켜지 않은 채 **딱 1회 수동 호출**해 실제 전환·메일을 발생시키고, wouldTransition 프리뷰와 결과가 일치하는지 관찰한다.

```bash
curl -X POST "https://<PROD_DOMAIN>/api/cron/shipping-poll" -H "Authorization: Bearer <CRON_SECRET>"
# 응답 예: {"ok":true,"polled":7,"transitioned":2,"skipped":4,"unsupported":1,"failed":0}
```

**합격 기준**
- `failed = 0`. (>0이면 Sentry `shipping.auto_complete`(phase: fetch/update) 확인 → 원인 수정 전까지 4단계 금지.)
- `transitioned` 건을 **실제 배송완료 주문과 1건 이상 수기 대조**(오전환 0):
  ```sql
  select id, order_no, status, delivered_at, delivered_via
  from orders where delivered_via = 'SYSTEM'
  order by delivered_at desc limit 20;
  ```
  → `status='DELIVERED'`, `delivered_at` 기록, `delivered_via='SYSTEM'` 확인.
- 해당 고객에게 **배송완료 메일이 정상 발송**됐는지 1건 확인 (Resend 로그/수신함).
- `unsupported`는 미지원 택배사(예: 로젠) — 정상. 필요 시 COURIER 코드맵 확장 백로그.

> 참고: 한 번에 최대 `BATCH_CAP=40`건(오래된 SHIPPING 우선). SHIPPING이 많으면 수동 invoke를 관찰하며 반복.
> ⚠️ 이 단계가 **첫 실 전환 + 첫 실 메일**이다. 응답을 보며 1회씩, 결과 확인 후 다음 호출.

---

### 4단계 — 스케줄 ON (마지막)
3단계가 깨끗할 때만 진행.

1. `supabase/migrations/044_shipping_poll_cron.sql`의 `__PROD_DOMAIN__` → 실제 `<PROD_DOMAIN>`로 치환.
2. 044 적용 (apply_migration 또는 CLI).

**합격 기준**
```sql
select jobname, schedule, active from cron.job where jobname='shipping-poll-hourly';
-- → ('shipping-poll-hourly', '0 * * * *', true)
```

---

### 5단계 — 첫 24h 모니터
- **pg_cron 실행 기록** (매 정각 tick):
  ```sql
  select d.status, d.start_time, d.end_time, d.return_message
  from cron.job_run_details d
  join cron.job j on d.jobid = j.jobid
  where j.jobname = 'shipping-poll-hourly'
  order by d.start_time desc limit 24;
  -- status='succeeded' 연속, return_message 정상
  ```
- **Sentry** tag `shipping.auto_complete`: phase=fetch/update/query 에러 0.
- **전환 추이**: `delivered_via='SYSTEM'` 일 증가가 합리적인지(폭주/0고착 아님).
- **고객 신고**: 배송완료 메일 오발송 0.
- **어드민 주문관리**: DELIVERED 행에 "자동 완료" badge 표기 확인.

---

## 롤백 절차 (이상 감지 시)
**순서 중요 — 스케줄을 먼저 끈다.** (안 끄면 데이터 원복 후 다음 tick이 재전환)

1. **즉시 정지** (스케줄만 off, 코드/컬럼 유지):
   ```sql
   select cron.unschedule('shipping-poll-hourly');
   ```
2. **완전 비활성** (수동 invoke까지 차단): 위 + Vercel `CRON_SECRET` 제거/회전.
3. **오전환 데이터 원복** (스케줄 off 확인 후, 건별):
   ```sql
   update orders
   set status='SHIPPING', delivered_at=null, delivered_via=null
   where id = '<order_id>' and delivered_via='SYSTEM';
   ```
   - 이미 발송된 배송완료 메일은 회수 불가 → 해당 고객 사과/정정 안내.
4. **원인 수정** 후 1~3단계부터 재검증. (043 컬럼은 추가형이라 DROP 불필요; 정 필요 시 `alter table orders drop column ...`.)

---

## 부록 — 빠른 참조
| 항목 | 값 |
|---|---|
| 라우트 | `POST /api/cron/shipping-poll` (Bearer `CRON_SECRET`) |
| dryRun | `?dryRun=1` — 판정·집계만(전환/메일 skip), `wouldTransition` 반환. 활성화 전 필수 게이트 + 상시 디버그 |
| 스케줄 | `0 * * * *` (매시 정각), job=`shipping-poll-hourly` |
| 배치/동시성 | `BATCH_CAP=40`, `CONCURRENCY=8`, fetch timeout 8s |
| 완료 판정 | `completeYN='Y'` ‖ `level≥6` ‖ `complete=true` |
| actor 기록 | `delivered_via='SYSTEM'` (수동은 `'ADMIN'`) |
| Sentry tag | `shipping.auto_complete` (phase: query/fetch/update) |
