# shadcn/ui on Base UI with Tailwind v4 for the Web UI Layer

**Status:** accepted
**Date:** 2026-08-18 14:06

## Context

`apps/web` was styled entirely with Material UI v7 (`@mui/material` 7.3.11, `@mui/icons-material`) on Emotion (`@emotion/react`, `@emotion/styled`). No ADR recorded that choice, so the constraints it imposed were undocumented.

### Current state before this decision

- 16 source files imported MUI; ~4,100 lines of the app's ~5,085.
- Styling was 253 `sx` prop occurrences, every one a plain object literal. Zero `styled()`, zero `useTheme`, zero `useMediaQuery`, zero `Grid`, zero `Stack`.
- `apps/web/src/theme.ts` was 333 lines: a `createTheme()` call with a hand-written palette and 14 `styleOverrides` blocks, all hardcoded hex. Light mode only, no CSS variables, no dark tokens.
- The palette restated Tailwind's indigo/rose/stone scales by hand (`#4F46E5`, `#E11D48`, `#FAFAF9`, `#1C1917`, `#E7E5E4`).
- Production bundle: **750.11 kB JS / 221.12 kB gzip**.

### Pain points

1. **Two styling systems in one file.** Visual decisions lived in `theme.ts` overrides *and* in per-instance `sx`, with no rule for which. `theme.ts` reached into MUI internals (`'& .MuiOutlinedInput-root'`) that an LLM cannot discover from the component's own source.
2. **Tokens were not addressable.** Changing the primary color meant editing ~30 hardcoded hex values across `theme.ts`, because overrides did not reference the palette.
3. **Dark mode was structurally blocked.** Every override hardcoded a color, so adding dark mode required rewriting the whole overrides block regardless of approach.
4. **Emotion's runtime cost.** Emotion is a required MUI peer that serializes and injects styles at runtime, for an app that used zero Emotion APIs directly.

### Constraints

- The app has **no frontend unit tests**. The only coverage was two Playwright suites sharing one set of page objects (`apps/web/e2e/pages/*.ts`, re-exported by `apps/web/tests-integration/pages/*.ts`).
- Those suites made 64 `getByRole`, 14 `getByLabel`, and 20 `getByTestId` queries — all resolving against MUI-generated DOM.
- `pnpm knip` (pre-push) fails on unused exports. `react-refresh/only-export-components` runs at `--max-warnings 0`. `pnpm-workspace.yaml` sets `minimumReleaseAgeStrict: true` on a 7-day window.

## Decision

Replace MUI and Emotion with **shadcn/ui components on Base UI (`@base-ui/react`), styled by Tailwind CSS v4**, and adopt shadcn's stock `neutral` token palette. Base UI became shadcn's default primitive layer in July 2026, so this is the mainline shadcn path.

Visual identity changes: the bespoke "Warm Premium" indigo/rose theme is retired in favour of shadcn's defaults. This was an explicit choice, not a side effect.

### Token layer replaces the theme object

`apps/web/src/theme.ts` is deleted. Tokens live in `apps/web/src/index.css` as CSS variables, mapped to Tailwind utilities by `@theme inline`:

```css
/* apps/web/src/index.css */
@import "tailwindcss";
@import "shadcn/tailwind.css";

@theme inline {
  --color-primary: var(--primary);
  --color-muted-foreground: var(--muted-foreground);
  --radius-lg: var(--radius);
}

:root {
  --primary: oklch(0.205 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --radius: 0.625rem;
}

.dark {
  --primary: oklch(0.922 0 0);
  --muted-foreground: oklch(0.708 0 0);
}
```

Both `:root` and `.dark` are complete. **No toggle ships** — nothing sets the `.dark` class, so the app renders light-only. Enabling dark mode is now adding a toggle, not authoring a theme.

### Styling moves from `sx` objects to utility classes

```tsx
// Before — MUI
<Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
  <Typography variant="h4" component="h1" gutterBottom>Checkout</Typography>
</Box>

// After — Tailwind
<div className="flex items-start gap-6">
  <h1 className="mb-4 text-2xl font-semibold tracking-tight">Checkout</h1>
</div>
```

### Primitives are owned source, not a dependency

```
apps/web/src/components/ui/
├── accordion.tsx      # shadcn, Base UI Accordion
├── alert.tsx          # shadcn, role="alert"
├── badge.tsx          # shadcn
├── button.tsx         # shadcn, exports Button + buttonVariants
├── checkbox.tsx       # shadcn, Base UI Checkbox
├── container.tsx      # local — fixed-width page wrapper
├── count-badge.tsx    # local — cart-count bubble anchored to an icon
├── form-field.tsx     # local — Label + Input + aria-invalid/aria-describedby
├── input.tsx          # shadcn, Base UI Input
├── label.tsx          # shadcn
├── pagination.tsx     # local — button-driven, not shadcn's <a> links
├── radio-group.tsx    # shadcn, Base UI RadioGroup
├── separator.tsx      # shadcn
├── sonner.tsx         # shadcn toast host
└── spinner.tsx        # shadcn, edited to expose role="progressbar"
```

Import chain: `src/pages/*.tsx` → `@/components/ui/*` → `@base-ui/react/*` and `@/lib/utils` (`cn`). The `@/` alias resolves via `paths` in `apps/web/tsconfig.app.json` and `resolve.alias` in `apps/web/vite.config.ts`.

### Navigation uses `buttonVariants`, never `Button`

Base UI's `Button` applies button semantics to whatever element it renders. As an anchor with `nativeButton` defaulted true it emits an invalid `type="button"`; with `nativeButton={false}` it stamps `role="button"`, which destroys the link role. Six `getByRole('link')` assertions depend on that role.

```tsx
// Wrong — measured: role=link count drops from 4 to 2
<Button render={<Link to="/cart" />}>Cart</Button>

// Right — renders a plain <a> with the button's classes
<Link to="/cart" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>Cart</Link>
```

### Form fields wire their own accessibility

MUI's `TextField` supplied label association and `aria-invalid`/`aria-describedby` for free. Base UI does not, so `form-field.tsx` supplies them once:

```tsx
function FormField({ id, label, error, className, ...props }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={cn('grid w-full gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && <p id={errorId} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

### Test harness decoupled before the swap

A separate first commit retargeted every MUI-specific selector onto stack-neutral hooks, then proved the suites green against the **unchanged** MUI app. Only then were components rewritten, so a red suite afterwards could only mean a migration defect.

| Coupling removed | Replacement |
|---|---|
| `[data-testid="AddIcon"\|"RemoveIcon"\|"DeleteIcon"]` (MUI icon internals) | `data-testid="increase-quantity"`, `decrease-quantity`, `remove-cart-item` |
| `getByRole('navigation', { name: 'pagination navigation' })` | `data-testid="pagination"` |
| `page.locator('button[aria-expanded]')` | `data-testid="order-accordion-trigger"` |
| MUI `TextField` auto-generated `id`/`htmlFor` | Explicit `id` on all 24 address fields |
| `getByLabel` on checkbox/radio | `getByRole('checkbox'\|'radio', { name })` — Base UI renders a visible `role="checkbox"` span *and* a hidden native input, so a wrapping `<label>` matches both |

`getByRole('progressbar')` was deliberately **kept**: it is a standard ARIA role, not an MUI internal, so `spinner.tsx` was edited to expose it.

## Consequences

### Positive

- **Bundle shrinks 22%**: 750.11 kB → 582.19 kB JS; 221.12 kB → 173.20 kB gzip. Four runtime dependencies removed (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`).
- **One styling system.** A component's appearance is readable from its own `className` and its primitive's `cva` map. No parallel override file, no `'& .MuiOutlinedInput-root'` reaching into a dependency's internals.
- **Tokens are addressable.** Changing `--primary` in `index.css` restyles every `bg-primary` usage. Previously this meant editing ~30 hex literals.
- **Dark mode is unblocked**: the `.dark` block and `@custom-variant dark` exist; only a toggle is missing.
- **Frontend gains unit tests.** `apps/web` had no `test` script, so `turbo run test` exercised zero frontend code. It now runs 14 Vitest + Testing Library tests covering the accessibility contracts Playwright cannot see.
- **Accessibility is explicit.** `aria-invalid`, `aria-describedby`, and label association are visible in `form-field.tsx` rather than implicit in a vendor component.

### Negative

- **Visual identity retired.** The indigo/rose Warm Premium theme is gone; the app is shadcn neutral. `docs/style-guide.md` was rewritten, not amended.
- **More owned code.** 15 primitive files are now this repo's maintenance burden. Upstream shadcn fixes require re-running the CLI per component.
- **Base UI's semantics are sharp.** The `Button`-as-link and dual-element-checkbox behaviors above are non-obvious, invisible in a diff, and each already caused a regression during migration. They are recorded in `docs/style-guide.md` under "Base UI Constraints".
- **Utility classes are verbose at call sites.** A card is `rounded-xl border bg-card p-6 shadow-sm` in each of ~8 places rather than one `MuiPaper` override.
- **`shadcn` is now a runtime dependency**, because `index.css` imports `shadcn/tailwind.css`.

### AI-Friendliness Impact

- **Discoverability: 5/5.** A component's styling is in its own file. Previously an LLM had to know `theme.ts` existed and that `MuiButton.styleOverrides` silently applied to every `<Button>`.
- **Cohesion: 5/5.** Appearance, structure, and behavior are co-located per component. The old split put appearance 333 lines away in a file the component never imports.
- **Pattern consistency: 4/5.** One rule now (token → variant → utility). Deducted because navigation must use `buttonVariants` while actions use `Button` — a real inconsistency, forced by Base UI's semantics.
- **Type coverage: 4/5.** `cva` derives variant props from the variant map, so an invalid `variant` is a type error; MUI's `sx` accepted any object. `React.ComponentProps<'input'>` on `FormField` is looser than a hand-written prop type.
- **Traceability: 5/5.** `page → @/components/ui/x → @base-ui/react/x` is a static import chain. MUI's theme overrides applied with no import edge at all.

**Overall AI-friendliness: 4.6/5**

## Options Considered

### Option A: shadcn/ui + Base UI + Tailwind v4 (chosen)

Primitives are copied into `src/components/ui/` and styled with Tailwind utilities over CSS-variable tokens.

- Base UI is shadcn's default as of July 2026, so `shadcn add` output needs no adaptation.
- Owned source means an LLM reads the actual component rather than inferring a vendor's runtime behavior.
- **Weakness, acknowledged:** 15 files to maintain, no automatic upstream fixes, and Base UI's semantics caused two regressions during migration that only the e2e suite caught.
- AI-friendliness: 4.6/5 — traceable imports and co-located styling, minus the `Button`/`buttonVariants` split.

### Option B: Stay on MUI v7, extract tokens to CSS variables

Keep MUI; rewrite `theme.ts` to reference CSS variables via `extendTheme`.

- Rejected: it fixes only pain point 2. The `sx`-versus-override ambiguity, the `'& .MuiOutlinedInput-root'` internals, and Emotion's runtime all remain. Bundle size does not improve.
- AI-friendliness: 2/5 — theme overrides still apply with no import edge, so an LLM cannot find them from the component.

### Option C: shadcn/ui + Radix primitives

Same components, Radix instead of Base UI (`shadcn init -b radix`).

- Rejected: Radix is no longer shadcn's default, so new registry items ship for Base UI first. Radix's `asChild` would have avoided the `Button`-as-link problem, which is a genuine point in its favour.
- AI-friendliness: 4.6/5 — equivalent. Rejected on ecosystem direction, not merit.

### Option D: Tailwind only, no primitive library

Utilities with hand-written components, no Base UI.

- Rejected: accessible accordion, radio group, and checkbox behavior (keyboard nav, focus management, ARIA state) would be hand-maintained. The Playwright suites already depend on that behavior.
- AI-friendliness: 3/5 — maximum transparency, but every component reinvents interaction patterns inconsistently.

## Migration Path

Each step is independently shippable and leaves the suites green.

1. **Decouple the test harness.** Retarget MUI-specific selectors onto `data-testid` hooks; add explicit `id` to all address fields. Verify both Playwright suites pass against the unchanged MUI app. This is the baseline.
2. **Add the foundation.** Install `tailwindcss` + `@tailwindcss/vite`; add the `@/` alias to `vite.config.ts` and `tsconfig.app.json`; run `pnpm dlx shadcn@latest init -b base -p nova`. Note TypeScript 7 has removed `baseUrl` — use `paths` alone.
3. **Add primitives.** `pnpm dlx shadcn@latest add button card input label checkbox radio-group alert badge separator accordion spinner sonner`. Author `container`, `count-badge`, `pagination`, `form-field`. Edit `spinner.tsx` to expose `role="progressbar"`.
4. **Migrate the 16 files** leaves-first, ending with `checkout.tsx`. Typecheck after each.
5. **Tear down.** Delete `src/theme.ts`; remove the four MUI/Emotion dependencies; confirm no `@mui`/`@emotion` references remain.
6. **Fix the gates.** `allowExportNames: ['buttonVariants']` for `src/components/ui/**`; `css.parser.tailwindDirectives` in `biome.json`; delete unused primitives so `pnpm knip` passes.
7. **Add the Vitest harness.** `vitest.config.ts`, `src/test/setup.ts`, and a `test` script so `turbo run test` covers the frontend. Test the accessibility contracts Playwright cannot see.
8. **Update the docs.** Rewrite `docs/style-guide.md` and `.claude/skills/design/SKILL.md`, both of which named `theme.ts` as the source of design tokens.
