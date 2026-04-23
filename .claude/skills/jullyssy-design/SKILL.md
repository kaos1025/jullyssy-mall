---
name: jullyssy-design
description: Use this skill to generate well-branded interfaces and assets for 쥴리씨 (Jullyssy), a Korean women's daily-casual fashion e-commerce brand, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Jullyssy (쥴리씨) Design Skill

Jullyssy is a minimal, white-tone women's-fashion mall for 20–40s Korean women. Warm orange primary, Pretendard type, mobile-first, benchmarked against `attrangs.co.kr`.

> **Note on paths**: 이 skill 의 모든 참조는 repo root 기준 `docs/design-system/project/` 아래의 번들 파일을 가리킵니다. 번들이 single source of truth 이며, 이 SKILL.md 는 Claude Code 에서 자동 로드되도록 배치된 래퍼입니다. 번들 원본을 수정했다면 `docs/design-system/project/SKILL.md` 와 이 파일을 함께 동기화하세요.

## How to use this skill

1. **Start by reading `docs/design-system/project/README.md`.** It has the full brand, content, and visual foundations.
2. **Import tokens from `docs/design-system/project/colors_and_type.css`.** 실 코드에서는 `src/app/globals.css` 와 `tailwind.config.ts` 에 이미 통합되어 있으므로 Tailwind 유틸리티 (`bg-warm-peach`, `text-error`, `font-display`, `tracking-wide-en`, `h-hero-m` 등) 를 우선 사용하세요. Do not invent new colours or scales.
3. **Reference `docs/design-system/project/preview/*.html`** for canonical examples of every component/state.
4. **Lift components from `docs/design-system/project/ui_kits/web/index.html`** for high-fidelity prototypes.

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

- **Visual artifact requests** (slides, mocks, prototypes): copy assets out of `docs/design-system/project/` and build static HTML files for the user to view.
- **Production code requests**: read `docs/design-system/project/colors_and_type.css` + the `docs/design-system/project/ui_kits/web/*` components and apply the rules directly — but always through the existing `src/app/globals.css` tokens and `tailwind.config.ts` utilities rather than re-declaring.
- **Ambiguous requests**: ask what they want to build, then act as an expert designer for this brand.

If anything in the user's ask conflicts with the rules above, flag it before building.
