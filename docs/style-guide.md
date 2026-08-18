# Style Guide

The visual language of the Mercado web app: Tailwind CSS v4 utilities over shadcn/ui primitives built on Base UI.

## Where Style Lives

| Layer | Location | Use for |
|-------|----------|---------|
| Design tokens | `apps/web/src/index.css` | Colors, radius, font family — one change propagates app-wide |
| Primitives | `apps/web/src/components/ui/` | Reusable component appearance, via `cva` variant maps |
| Instances | Page and component `className` props | Layout and one-off spacing only |

Prefer the highest layer that can carry the change. Reach for a per-instance class only when neither a token nor a variant fits.

## Design Tokens

Defined as CSS variables under `:root` (light) and `.dark`, then mapped to Tailwind utilities by the `@theme inline` block. The palette is shadcn's stock `neutral` base color in `oklch`.

| Token | Utility | Role |
|-------|---------|------|
| `--background` / `--foreground` | `bg-background` / `text-foreground` | Page surface and body text |
| `--card` / `--card-foreground` | `bg-card` | Raised surfaces: cards, panels, summary boxes |
| `--primary` / `--primary-foreground` | `bg-primary` | Primary actions, active pagination |
| `--secondary` / `--secondary-foreground` | `bg-secondary` | Quantity steppers, secondary chips |
| `--muted` / `--muted-foreground` | `bg-muted` / `text-muted-foreground` | Image placeholders, supporting text |
| `--destructive` | `bg-destructive` / `text-destructive` | Errors, delete actions, discount badges |
| `--border` / `--input` / `--ring` | `border-border`, `border-input`, `ring-ring` | Outlines and focus rings |
| `--radius` | `rounded-sm` … `rounded-4xl` | Corner rounding; derived by calc, so one value scales the set |

Never hardcode a hex or `oklch()` in a component. If no token fits, add one — and add it to **both** `:root` and `.dark`.

### Dark mode

The `.dark` token block is complete, and `@custom-variant dark` is wired. **No toggle ships** — nothing sets the `.dark` class, so the app renders light-only. Enabling dark mode is adding a toggle, not authoring tokens.

## Typography

Font family is `--font-sans` (Geist Variable, self-hosted via `@fontsource-variable/geist`). Sizing uses Tailwind's default scale.

| Role | Classes |
|------|---------|
| Page title (`<h1>`) | `text-2xl font-semibold tracking-tight` |
| Section heading (`<h2>`) | `text-lg font-semibold` |
| Card title (`<h2>`) | `text-base font-semibold` |
| Label heading (`<h3>`) | `text-xs font-semibold tracking-wider text-muted-foreground uppercase` |
| Body | default size |
| Supporting | `text-sm text-muted-foreground` |
| Fine print | `text-xs text-muted-foreground` |

Heading **elements** are load-bearing: the e2e suites assert `getByRole('heading', { level })`. Change the classes, not the tag.

## Surfaces

The recurring card/panel treatment:

```tsx
<div className="rounded-xl border bg-card p-6 shadow-sm">
```

Product cards add `overflow-hidden transition-shadow hover:shadow-md`. Page width is the `Container` primitive (`mx-auto w-full max-w-6xl px-4`).

## Layout

Tailwind breakpoints are **min-width**. `hidden md:block` means hidden below `md` — the base utility is required, and a missing one silently inverts the layout.

Recurring patterns:

- Main/sidebar split: `flex flex-col gap-6 md:flex-row`
- Cart sidebar visibility: `hidden w-75 shrink-0 md:block`
- Product grid: `grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

Flex children holding text need `min-w-0` and often `truncate` or `line-clamp-2`; without it, long product names force horizontal overflow.

## Primitives

Added with `pnpm dlx shadcn@latest add <component>`, configured by `components.json` (Base UI, `base-nova` preset). Generated files are yours to edit.

Locally authored primitives with no shadcn equivalent:

| Primitive | Why it exists |
|-----------|---------------|
| `container.tsx` | Fixed-width page wrapper |
| `count-badge.tsx` | Cart-count bubble anchored to an icon; shadcn's `Badge` is an inline chip |
| `pagination.tsx` | Renders `<button>` page items driven by state; shadcn's ships `<a>` links |
| `form-field.tsx` | Label + input with `aria-invalid` / `aria-describedby` wiring |

`spinner.tsx` is a shadcn primitive edited to expose `role="progressbar"`.

Unused primitives fail `pnpm knip` at pre-push. Only add what you use.

## Base UI Constraints

Behavior that is not obvious from the markup and has already caused regressions:

- **Navigation is a link, not a button.** Use `<Link className={buttonVariants({...})}>`. Base UI's `Button` applies button semantics to whatever it renders — as an anchor it emits an invalid `type="button"`, and with `nativeButton={false}` it stamps `role="button"`, breaking `getByRole('link')`.
- **`Checkbox` and `Radio` render two elements**: a visible `role="checkbox"` span plus a hidden native input, and the `id` prop lands on the *hidden* input. A wrapping `<label>` therefore matches both, so query them by `getByRole('checkbox', { name })`, not `getByLabel`.
- **Portals need a stacking context.** `#root` carries `isolation: isolate` and `body` carries `position: relative`; both are required for popovers and backdrops.

## Accessibility Contracts

The Playwright suites query by role, accessible name, and label. These are behavioral contracts, not styling:

- Every form input is associated with a `<Label>` via `htmlFor`/`id` — use `FormField`, which does this
- Validation errors set `aria-invalid` and `aria-describedby` on the input
- `Alert` renders `role="alert"`; `Spinner` renders `role="progressbar"` named "Loading"
- Icon-only buttons carry an `aria-label`
- Pagination items are buttons named `Go to page N`

## data-testid Preservation Checklist

Never remove or rename these.

| Attribute | File |
|-----------|------|
| `product-card` | `products.tsx`, `search-results.tsx` |
| `pagination` | `products.tsx`, `search-results.tsx` |
| `quantity-input` | `product-detail.tsx` |
| `add-to-cart-button` | `product-detail.tsx` |
| `increase-quantity` / `decrease-quantity` | `product-detail.tsx`, `cart.tsx` |
| `cart-item` | `cart.tsx` |
| `cart-item-quantity` | `cart.tsx` |
| `remove-cart-item` | `cart.tsx` |
| `order-accordion-trigger` | `orders-page.tsx` |
| `address-card` | `addresses-page.tsx` |
| `default-chip` | `addresses-page.tsx` |
| `save-shipping-checkbox` | `checkout.tsx` |
| `shipping-new-radio` | `checkout.tsx` |
| `shipping-radio-${id}` | `checkout.tsx` |

## Verifying a Design Change

```bash
pnpm --filter @mercado/web test              # primitive contracts
pnpm --filter @mercado/web test:integration  # MSW-mocked flows, no backend
pnpm test:e2e                                # full stack
```

A screenshot cannot show a broken role or a dropped label association. Run the suites.
