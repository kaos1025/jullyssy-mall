# 쥴리씨 디자인 시스템 사용 가이드

## 1. 소스 위치 (SSOT)

- **`docs/design-system/project/`** — 디자인 시스템 single source of truth
  - `README.md` — 브랜드 + 비주얼 파운데이션
  - `SKILL.md` — Claude Code Skill 원본
  - `colors_and_type.css` — 토큰 원본
  - `preview/*.html` — 컴포넌트 canonical example 16개
  - `ui_kits/web/index.html` — 홈 + PDP 완전 재현
- **`.claude/skills/jullyssy-design/SKILL.md`** — 경로 재작성된 얇은 래퍼 (Claude Code 자동 로드용)

## 2. 토큰이 실제로 적용되는 3 군데

| 위치 | 역할 |
|---|---|
| `src/app/globals.css` | `:root` CSS 변수 (~50개) + `.jl-*` 시멘틱 타입 클래스 |
| `tailwind.config.ts` | Tailwind 유틸리티 매핑 (`bg-warm-peach`, `text-error`, `h-hero-m`, `tracking-kr` 등) |
| `.claude/skills/jullyssy-design/SKILL.md` | Claude Code 가 UX 작업 시 참조하는 Skill 래퍼 |

## 3. 수정 플로우

### 토큰 값 변경 (예: primary 조정)
1. `docs/design-system/project/colors_and_type.css` 수정 (SSOT)
2. `src/app/globals.css` 의 Jullyssy 섹션에 동기화
3. 새 변수가 Tailwind 유틸리티로 필요하면 `tailwind.config.ts` 에 매핑 추가
4. `npm run build` 로 CSS 컴파일 확인

### 새 참조 파일 추가 (예: 새 preview)
1. `docs/design-system/project/preview/<name>.html` 추가
2. `docs/design-system/project/SKILL.md` 본문에 참조 추가
3. `.claude/skills/jullyssy-design/SKILL.md` 에 동일 내용 (경로 재작성 반영) 추가

## 4. ⭐ Skill 동기화 (중요)

`SKILL.md` 는 **두 위치에 존재**합니다:
- 원본: `docs/design-system/project/SKILL.md` — 번들 내부 상대 경로 (`README.md`, `preview/*.html`)
- 래퍼: `.claude/skills/jullyssy-design/SKILL.md` — repo root 기준 절대 경로 (`docs/design-system/project/README.md`)

래퍼 상단에 "번들이 SSOT, 이 파일은 래퍼" note 가 있습니다. 번들 SKILL.md 를 수정했다면:
- 래퍼도 같은 내용으로 갱신 (단, 모든 상대 경로는 `docs/design-system/project/...` 로 치환)
- `git diff` 로 두 파일이 경로 부분 제외하고 동일한지 주기적 확인 권장

## 5. shadcn/ui 호환성 (⛔ 파괴 금지)

`--primary`, `--foreground`, `--background`, `--border`, `--muted`, `--accent`, `--secondary`, `--destructive`, `--ring`, `--radius` 등 **shadcn 필수 변수는 HSL 트리플렛 형식으로 절대 유지**해야 합니다. Tailwind config 가 `hsl(var(--primary))` 패턴으로 소비하기 때문.

번들 고유 변수 (`--primary-50~700`, `--warm`, `--success`, `--fs-*`, `--shadow-*` 등) 는 별도 이름이므로 자유롭게 추가/수정 가능합니다. 번들 원본의 `--primary: var(--primary-500)` 재선언 라인은 **복사하지 않는 것이 이 레포의 규칙**입니다.

## 6. 새 유틸리티 사용 예시

```tsx
{/* Warm 배경 */}
<section className="bg-warm-peach h-hero-m">...</section>

{/* 의미 색상 */}
<span className="text-error">필수 입력 항목입니다</span>
<div className="bg-success/10 text-success">결제 완료</div>

{/* 영문 장식 */}
<h1 className="font-display tracking-wide-en text-4xl">SPRING COLLECTION</h1>

{/* 한국어 자간 */}
<p className="tracking-kr">한국어 본문은 살짝 좁은 자간이 자연스럽습니다</p>

{/* 레이아웃 토큰 */}
<header className="h-header sticky top-0">...</header>
<div className="max-w-container mx-auto">...</div>
<section className="h-hero-m md:h-hero-d">...</section>

{/* 시멘틱 타입 클래스 */}
<p className="jl-price">39,000원</p>
<p className="jl-price-strike">49,000원</p>
<span className="jl-label-eyebrow">new arrival</span>
```

## 참고

- 브랜드 규칙 전문: [`project/README.md`](./project/README.md)
- 컴포넌트 예시: [`project/preview/`](./project/preview/), [`project/ui_kits/web/index.html`](./project/ui_kits/web/index.html)
- 절대 금지 목록은 Skill 본문의 "Non-negotiable rules" 참조
