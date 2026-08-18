# Frontend integration tests

Playwright specs that exercise the checkout flow through the real Vite dev server, with all
`/api` traffic mocked by MSW (`src/mocks/`) instead of a live backend. No `@mercado/backend`
process is started — run these with the backend stopped to confirm true isolation.

Distinct from `e2e/`, which drives the same flows against a real backend and database. Use this
layer for behavior that's impractical to set up against a real backend (validation/out-of-stock
errors, 5xx responses, slow-network loading states, empty-state variations).

## Running

```bash
pnpm --filter @mercado/web test:integration
pnpm --filter @mercado/web test:integration:ui
```

## Adding a mock endpoint

1. Add a typed factory in `src/mocks/data/<domain>.ts`.
2. Add a happy-path default in `src/mocks/handlers.ts`.
3. Override per-test via the `mswControl` fixture — `useBeforeLoad()` for handlers that must be
   active before the page's first render (auth, initial data fetches), `use()` for handlers
   registered after the page has loaded (e.g. before a user-triggered mutation).

## Maintenance

After upgrading `msw`, regenerate the service worker script:

```bash
pnpm --filter @mercado/web msw:init
```
