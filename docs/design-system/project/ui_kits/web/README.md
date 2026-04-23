# Jullyssy — Web UI Kit (mobile-first)

High-fidelity recreation of the live `jullyssy.shop` Next.js app, rendered as a
single static HTML prototype (`index.html`).

## What's in `index.html`

| Surface | Source component (repo) |
|---|---|
| Sticky header + category nav | `src/components/layout/Header.tsx` |
| Mobile tab bar | `src/components/layout/MobileNav.tsx` |
| Hero slider (peach) | `src/components/home/HeroBanner.tsx` |
| Category pills | `src/app/(shop)/page.tsx` (inline) |
| Product card × 8 | `src/components/product/ProductCard.tsx` |
| `NEW ARRIVAL` / `WEEKLY BEST` rows | `src/app/(shop)/page.tsx` |
| 2× promo banners | `src/app/(shop)/page.tsx` |
| Footer (brand · CS · biz) | `src/components/layout/Footer.tsx` |
| PDP — gallery + buy bar | `src/app/(shop)/products/[id]/page.tsx` |

## Interactions wired

- **Tap any product card** → flips to PDP view.
- **Toggle buttons above the phone** switch Home ↔ PDP.
- **PDP thumbnails** swap the main image.
- **View state persists** via `localStorage` (`jl-view`).

## Known cosmetic stand-ins

- **Product photography**: flat warm-neutral gradient tiles stand in for real
  shots. Replace the `TONES` array in `index.html` with real 3:4 image URLs to
  see final fidelity.
- **Hero slide**: shows only the `WEEKLY BEST` pastel variant — the live repo
  rotates three background classes. Behavior (autoplay, swipe, dots) is
  faithful; visual carousel not wired to save file size.
- **Search / accordion / sheet**: icons and entry points are present; full
  overlays are out of scope for a static kit.

## Design-system parity

Every colour, radius, font, spacing and icon comes from `colors_and_type.css`
tokens. **No custom colours are introduced** in this kit.

If anything drifts from the live site, it's a bug in this kit — the source of
truth is the codebase, not this file.
