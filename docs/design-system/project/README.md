# 쥴리씨 (Jullyssy) Design System

> 20~40대 여성을 위한 데일리 캐주얼 여성의류 자사몰.
> "화면 너머의 여러분에게 따뜻한 쇼핑메이트."

**Stack:** Next.js 14 (App Router) · Tailwind CSS · shadcn/ui · Pretendard · lucide-react
**Benchmark:** [attrangs.co.kr](https://attrangs.co.kr) — 미니멀 화이트 톤 여성의류 자사몰
**Domain:** jullyssy.shop

---

## 🗂 Index

| File / folder | What it is |
|---|---|
| `colors_and_type.css` | All tokens — colours, type scale, spacing, radii, shadows, semantic vars |
| `SKILL.md` | Agent-Skills-compatible entry point (for Claude Code download) |
| `preview/` | 15 Design-System cards (colours, type, components, voice) |
| `ui_kits/web/` | Mobile-first recreation of `jullyssy.shop` — home + PDP |
| `assets/` | Logo wordmark, icon references |
| `uploads/` | Original source material (brand guide, screenshots) |

---

## Sources referenced

| Source | Path / Link | Notes |
|---|---|---|
| Brand guide | `uploads/쥴리씨_브랜드_가이드.md` | 280 lines, full brand + tech spec |
| Live mobile screenshots | `uploads/jullyssy.shop_(iPhone 14 Pro Max)*.png` | Home + PDP |
| Live desktop screenshot | `uploads/화면 캡처 2026-04-23 084031.jpg` | Home |
| Benchmark — attrangs home | `uploads/화면 캡처 2026-04-23 084139.jpg` | Aesthetic reference |
| Benchmark — attrangs PDP | `uploads/화면 캡처 2026-04-23 084202.jpg` | Product detail layout |
| Codebase | GitHub `kaos1025/jullyssy-mall` @ `main` | Next.js 14 / Tailwind / shadcn |

### ⚠️ Colour override (critical)

The live codebase `globals.css` has `--primary: 25 95% 53%` already (a warm orange).
The brand guide also specifies **warm orange** as primary. This system locks that in and
**forbids rose/pink as primary.** Rose tones may appear ONLY as a product photograph
background (parchment peach) — never as a UI accent.

---

## 1 · CONTENT FUNDAMENTALS

### Voice

Warm but restrained. We're the customer's *쇼핑메이트* — a friend who knows fashion —
not a hype-merchant. Every line stays in **polite Korean (존댓말)**.

| ✅ Do | ❌ Don't |
|---|---|
| "오늘 주문 시 내일 도착" | "🔥 초특가 세일!!! 🔥" |
| "봄 신상 입고" | "대박!!! 역대급 할인!!!" |
| "무료배송 (5만원 이상)" | "지금 아니면 못 사요!!" |
| "주문을 완료하지 못했어요. 다시 시도해주세요." | "오류가 발생했습니다." |
| "이번 주 가장 사랑받은" | "모두가 난리난 바로 그 아이템!" |

### Casing & script rules

- **Korean body copy**: 존댓말, ~요/~세요. Short sentences. 자간 `-0.01em`.
- **English display headers**: ALL CAPS, 넓은 자간 (`tracking-wider` / `0.12em`).
  Examples: `JULLYSSY`, `NEW ARRIVAL`, `WEEKLY BEST`, `SPRING COLLECTION`, `SOLD OUT`.
- **Eyebrow labels**: UPPERCASE, 아주 넓은 자간 (`0.3em`). `EVENT`, `SHIPPING`, `JULLYSSY`.
- **Numbers always formatted** with `toLocaleString()`: `43,900원` (not `43900원`).
- **Discount %** always preceded by `-`: `-12%`.

### Pronouns

- Second-person: **"여러분"** (brand voice) or implicit (imperative).
- Never *"고객님"* in marketing copy — reserved for support/email.
- Never *"너"* or casual ~야/~어.

### Emoji & exclamation

- **No emoji in UI copy.** The brand guide is explicit: no 🔥, 🎉, ❗, 😍.
- The *only* emoji sighting in the live site is the search-bar placeholder
  (`🌷 봄 신상 BEST 아이템`) — a single seasonal tulip. Treat this as the outer limit.
- **One `!` per paragraph, max.** Prefer period endings.

### CTA strings (canonical)

| Action | Label |
|---|---|
| Add to cart | 장바구니 담기 |
| Buy now | 바로구매 · 구매하기 |
| Login | 로그인 |
| Signup | 회원가입 |
| Apply coupon | 쿠폰 적용 |
| See more | 더보기 → |
| Hero CTA | 쇼핑하기 → |

### The vibe in one line

*Sunday-morning minimal — an Instagram-adjacent Korean fashion feed that thinks in
white space, lets the photography do the talking, and keeps the orange strictly
for decisions (price, CTA, activation).*

---

## 2 · VISUAL FOUNDATIONS

### Colour

- **Backgrounds 90%+ of the time are pure white.** Secondary surface is
  `--subtle` (#FAFAF8) or `--warm` (#F5F0EB) — used only to break section rhythm
  (e.g. WEEKLY BEST band, footer).
- **Primary (warm orange `#F97316`) is a scalpel, not a brush.** Rules:
  1. Never paints a whole section or hero background.
  2. Appears ≤ 2 places per viewport (CTA + 하나의 활성 상태, usually).
  3. Uses: Primary button, active category pill, active tab-bar icon, discount %,
     the `쥴리씨` wordmark, search-focus ring.
- **Gray is the workhorse.** Body text `--gray-700`, headings `--gray-900`,
  borders `--gray-100 ~ 200` (hair thin), meta `--gray-500`.
- **Discount red `#D94B4B`** is the SINGLE exception where a second warm colour
  is allowed — only on the round discount-rate badge (top-right of product card).
- Screens carry **3 colours or fewer**: white + gray scale + 1 point.

### Typography

- Body & UI: **Pretendard Variable** (already loaded in host app).
- Display serif: **Cormorant Garamond** for English marketing heads
  (`NEW ARRIVAL`, `SPRING COLLECTION`). Adds editorial warmth against an otherwise
  clean sans UI. If unavailable, fall back to *Cormorant* from Google Fonts
  (**flagged — see below**).
- Weights used: Regular 400 / Medium 500 / SemiBold 600 / Bold 700. **No other weights.**
- Max 3 weights per screen.
- Line-height: 1.5 body, 1.3 headings. Letter-spacing: `-0.01em` Korean body,
  `0.12em` English display, `0.3em` eyebrow labels.

### Backgrounds & imagery

- Full-bleed hero banners with **subtle pastel/peach tint overlay** (`bg-warm-peach`
  or `from-primary/20 to-accent/20` gradient). Never saturated.
- Product photography is **natural-light, white/cream backdrops, model-on-location**
  — warm neutral tint, never cool, never b&w, never grain.
- **No repeating patterns. No textures. No illustrations.** The photography carries
  all imagery weight.
- Gradients appear ONLY in soft pastel hero tints (e.g. `warm-peach → cream`).
  **No purple/blue gradients. No neon. No radial gradients.**

### Animation & motion

- Tailwind defaults only — `transition-colors`, `transition-all duration-300~500 ease-in-out`.
- Hero slider: 500ms translateX, 5s autoplay with hover-pause.
- Product card hover: `scale-105` on image (500ms); cross-fade to hover image;
  wish/cart icons fade-up from bottom-right.
- **No bounces. No spring physics. No parallax. No scroll-triggered reveals.**
  Micro-interactions stay under the user's radar.

### Hover states

- Primary button: `bg-primary` → `bg-primary/90` (subtle darken).
- Outline button: white → `bg-accent`/`bg-muted`.
- Links: gray → primary on hover.
- Product-card image: `scale-105` + crossfade to second image.
- Icon buttons: colour-only (never size change).

### Press / active states

- Active pill/tab: **filled primary** (bg + white text), not outlined.
- Active tab icon: primary colour, same stroke weight (1.5).
- No shrink/translate on press. No ripple.

### Borders

- **1px only.** Thickness never varies.
- Default `--gray-200`; soft dividers `--gray-100`; focus rings `--primary/30`.
- Tab active indicator: 2px primary on the bottom edge only.
- **No thick borders (2px+) in components.** The one exception is the tab
  underline and the input focus ring.

### Shadows

- Philosophy: **shadows barely exist.** Sticky header uses `shadow-sm`
  *instead of* a border. Dropdown menus: `shadow-md border`. Everything else: none.
- Product cards have **no shadow, no border** — they float on white, defined only by
  the rounded image.

### Transparency & blur

- Sticky header: `bg-white/95 backdrop-blur-sm` (frosted glass, subtle).
- Hero slider arrows: `bg-white/60 backdrop-blur-sm`.
- Hover quick-action pills on product card: `bg-white/90 backdrop-blur-sm`.
- Sold-out overlay: `bg-black/50` flat (no blur).
- Blur is **always `backdrop-blur-sm`** — never `-md`/`-lg`.

### Corner radii

- **`rounded-lg` (8px) is the default** for cards, buttons, images, inputs.
- `rounded-full` for pills, avatars, icon buttons, the hero dot pagination,
  and the `-12%` discount bubble.
- `rounded-sm` (4px) for the rectangular `NEW` badge.
- **No sharp (0px) corners anywhere.** No oversized radii (>12px).

### Card anatomy

```
ProductCard — no shadow, no border.
├── aspect-[3/4]  rounded-lg  overflow-hidden  bg-muted
│   ├── <Image object-cover> group-hover:scale-105
│   ├── (optional) 2nd image — crossfade on hover
│   ├── badge top-left — NEW (rounded-sm, black bg)
│   ├── badge top-right — discount % (rounded-full, destructive bg)
│   └── quick actions bottom-right — 2 × rounded-full buttons, hover-only
├── mt-2.5  min-h-[90px]
├── price row — discount% primary · strike meta · final bold
├── free-shipping micro-tag — 11px primary
├── product name — 14px, line-clamp-2, leading-snug, muted-fg
└── color dots — 10px circles, gray-border
```

### Layout rules

- Mobile-first. **All screens start at 375px (iPhone SE).** Touch targets ≥ 44×44.
- Content is `container` (max 1280px) centre-aligned with `px-4` mobile / `px-8` PC.
- Grid: 2-col products mobile, 4-col desktop at `md:` (768px+).
- Header (56px) sticky top, mobile tab-bar (60px + safe-area) sticky bottom.
- Footer padded `pb-24` on mobile so it clears the fixed tab-bar.
- Section dividers = whitespace + `bg-subtle` swap, never a line.
- Hero **must be 40vh on mobile** — products stay peeking above the fold.

### Fixed/sticky elements

| Element | Position | Z |
|---|---|---|
| Header | `sticky top-0`, `h-14` | 50 |
| Mobile tab-bar | `fixed bottom-0`, `h-[60px]+safe-area` | 50 |
| PDP buy-CTA (mobile) | `fixed bottom-0` full-bleed, above tab-bar | 40 |
| Sheet (category drawer) | side: left, width 300px | 50 |

---

## 3 · ICONOGRAPHY

- **Library:** `lucide-react` (fixed). CDN for static HTML use:
  `https://unpkg.com/lucide@latest`.
- **Stroke weight:** `strokeWidth={1.5}` — thin, modern. Never 2 or 2.5.
- **Sizes:** 24 default · 22 tab-bar · 20 header · 16 inline · 14 micro.
- **Colour:** inherits from text. Active = primary. Inactive (tab-bar) = gray-400.
- **No icon fills.** Outline-only. The heart is outline even on the wishlist action.
- **No emoji in UI.** The search placeholder `🌷 봄 신상 BEST 아이템` is the only
  sanctioned exception (seasonal rotation, input decoration only).
- **No unicode icons** (★, ✓, →, etc.) **except**:
  - `★` in review ratings (`★ 4.8 (23)`).
  - `→` in navigation CTAs (`쇼핑하기 →`, `더보기 →`) — stylistic, not semantic.
- **❌ No circular category icons** — brand guide forbids this pattern (clothing
  categories have no natural metaphor). Use **text pills** instead.

See `assets/` for the local logo wordmark + the full lucide icon list actually in
use across the repo.

---

## 4 · File index

```
.
├── README.md                  ← this file (brand + voice + visual foundations)
├── SKILL.md                   ← Claude Skill entrypoint
├── colors_and_type.css        ← all design tokens, semantic type classes
├── assets/
│   ├── logo-wordmark.svg      ← 쥴리씨 display-serif wordmark (primary orange)
│   ├── icons-in-use.md        ← lucide-react icons actually used in repo
│   └── placeholders/          ← product photo placeholders (3:4)
├── preview/                   ← Design System tab cards (one concept per file)
│   ├── colors-primary.html
│   ├── colors-neutral.html
│   ├── colors-semantic.html
│   ├── type-display.html
│   ├── type-scale.html
│   ├── spacing.html
│   ├── radii-shadows.html
│   ├── buttons.html
│   ├── badges.html
│   ├── product-card.html
│   ├── pill-chips.html
│   ├── tab-bar.html
│   ├── header.html
│   ├── forms.html
│   └── voice-tone.html
└── ui_kits/
    └── web/                   ← mobile-first Next.js-parity recreation
        ├── README.md
        ├── index.html
        ├── Header.jsx
        ├── MobileNav.jsx
        ├── HeroBanner.jsx
        ├── CategoryPills.jsx
        ├── ProductCard.jsx
        ├── ProductGrid.jsx
        ├── Footer.jsx
        ├── ProductDetail.jsx
        └── screens/
            ├── HomeScreen.jsx
            ├── ListScreen.jsx
            └── PDPScreen.jsx
```

---

## 5 · Known substitutions (flag to user)

- **Cormorant Garamond** (display serif for `NEW ARRIVAL`, etc.) — loaded from
  Google Fonts CDN in static HTML. Repo references this font family directly; no
  self-hosted file exists in-repo. **⚠️ Please confirm licence/self-hosting
  preference for production.**
- **Pretendard** — loaded via `cdn.jsdelivr.net/gh/orioncactus/pretendard` web-font
  in static HTML previews. The host app uses `Pretendard Variable` via the
  `pretendard-variable` npm entry. No substitution needed; flagged for parity only.
- **Product photography** — no real assets available from the brand. Previews use
  neutral grey/warm tiles as 3:4 placeholders. **⚠️ Please provide a starter set of
  flat-lay or model shots so the UI kit can feel real.**
