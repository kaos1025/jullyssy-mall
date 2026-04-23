---
name: jullyssy-design
description: Use this skill to generate well-branded interfaces and assets for 쥴리씨 (Jullyssy), a Korean women's daily-casual fashion e-commerce brand, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Jullyssy (쥴리씨) Design Skill

Jullyssy is a minimal, white-tone women's-fashion mall for 20–40s Korean women. Warm orange primary, Pretendard type, mobile-first, benchmarked against `attrangs.co.kr`.

## How to use this skill

1. **Start by reading `README.md`.** It has the full brand, content, and visual foundations.
2. **Import tokens from `colors_and_type.css`.** Do not invent new colours or scales.
3. **Reference `preview/*.html`** for canonical examples of every component/state.
4. **Lift components from `ui_kits/web/index.html`** for high-fidelity prototypes.

## Non-negotiable rules

- **Primary is warm orange** (`#F97316` / `oklch(0.7 0.17 47)`). Never rose/pink.
- **Mobile-first, start at 375px.** Hero banner is always `40vh` (never 60vh).
- **Product cards are strictly 3:4 (`aspect-[3/4]`).** Never square.
- **Pretendard for everything**; Cormorant Garamond ONLY for English-only decorative text (hero banners, `NEW ARRIVAL` / `WEEKLY BEST` dividers). Never for Korean, mixed KR/EN, product names, prices, body, or buttons.
- **lucide-react icons, `strokeWidth 1.5`.** No other icon sets.
- **Forbidden:** thick borders, heavy shadows, gradients, neon, circular category icons, salesy copy (`🔥 초특가!!`).
- **Tone: 존댓말, warm but restrained.** No emoji spam. No "대박!!!"-style copy.
- **Stack constraint: Tailwind utilities + shadcn/ui only.** Minimal custom CSS.

## What to produce

- **Visual artifact requests** (slides, mocks, prototypes): copy assets out of this folder and build static HTML files for the user to view.
- **Production code requests**: read `colors_and_type.css` + the `ui_kits/web/*` components and apply the rules directly.
- **Ambiguous requests**: ask what they want to build, then act as an expert designer for this brand.

If anything in the user's ask conflicts with the rules above, flag it before building.
