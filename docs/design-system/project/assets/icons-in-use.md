# Icons in use (lucide-react, strokeWidth 1.5)

Pulled from `kaos1025/jullyssy-mall` repo — every `lucide-react` import found.

## Navigation & chrome
- `Menu` — hamburger (mobile header)
- `Search` — header search
- `User` — account / mypage
- `Heart` — wishlist / 찜 (outline only, never filled)
- `ShoppingBag` — cart (also "장바구니" tab-bar)
- `Home` — 홈 tab
- `Grid2X2` — 카테고리 tab
- `ChevronLeft` / `ChevronRight` — hero slider arrows, PDP image gallery
- `ChevronDown` — accordion, footer ABOUT toggle
- `ArrowRight` — "더보기" link, hero CTA

## Product
- `PackageOpen` — empty related-products state
- `MessageSquare` — empty reviews state
- `HelpCircle` — empty Q&A state
- `Camera` — Instagram social link
- `MessageCircle` — KakaoTalk social link
- `LogOut` — signout item

## Forms / state
- `Check` — checkbox, success
- `X` — close sheet/dialog
- `Plus` / `Minus` — quantity stepper
- `Trash2` — remove from cart

## Usage rules
- `strokeWidth={1.5}` always. **Never 2.**
- Size map: 24 default · 22 tab-bar · 20 header · 16 inline · 14 micro · 12 meta.
- Colour is `currentColor`. Active = `text-primary`. Inactive tab-bar icon = `text-gray-400`.
- Outline only; no `fill` property, no filled variants.

## Loading pattern (for static HTML previews)

```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="heart"></i>
<script>lucide.createIcons({ attrs: { "stroke-width": 1.5 } });</script>
```
