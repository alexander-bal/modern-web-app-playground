# Migrate Session Authentication to Better Auth

**Status:** accepted
**Date:** 2026-08-18

## Context

`docs/adr/2026-03-05-12-49-session-based-auth.md` established a hand-rolled session-cookie auth system: a `users`/`sessions` Drizzle schema, argon2id password hashing, a Fastify `onRequest` plugin validating a `sid` cookie, and an oRPC `auth` module for register/login/logout/me. That system worked, but every future capability — email verification, password reset, OAuth, 2FA — meant building and maintaining more of a full auth stack by hand.

This ADR supersedes it: authentication now runs on [Better Auth](https://better-auth.com) (`better-auth` npm package, pinned `^1.6.26`), a maintained library covering session handling, password hashing, and a path to the capabilities above without more hand-rolled code. There was no real user data in the database at migration time, so this was a clean schema swap, not a data migration.

## Decision

### Schema

`users`/`sessions` are replaced with Better Auth's own four tables — `user`, `session`, `account`, `verification` — added via `apps/backend/src/db/schema.ts` and `pnpm db:generate`/`pnpm db:migrate`, per this repo's migration workflow. Credentials now live in `account` (one row per auth method), not on `user`.

The business columns the old `users` table carried (`isAdmin`, `adminRole`, `adminCompanyIds`, `phone`, `locale`, `config`, `isOptedInToMarketing`, `plainCustomerId`, `plainLastSyncedAt`) — none of which have any consumer in the codebase today, verified by exhaustive grep — are preserved as `additionalFields` on `user`, since `isAdmin`/`adminRole` in particular read as forward-looking fields for an admin feature that hasn't landed yet. `salt` (argon2-specific) and `confirmedEmailAt` are dropped; `confirmedEmailAt` is superseded by Better Auth's native `emailVerified` boolean.

`firstName`/`lastName` stay as `additionalFields` too (the register form collects them separately), with Better Auth's required core `name` field populated as `${firstName} ${lastName}` at sign-up.

**Migration-generation note**: because `users`→`user`/`sessions`→`session` are similarly named, generating the schema diff in one pass makes `drizzle-kit generate` prompt interactively to disambiguate rename-vs-create — which fails non-interactively. Generating it as three sequential migrations instead (drop the `addresses` FK → drop the old tables → add the new tables + FK) avoids the ambiguity, since no step has both an old and a similarly-named new table in play at once.

**Applying this on a database with existing rows**: the second migration (`DROP TABLE "users"/"sessions" CASCADE`) is destructive by design — accepted per the "no real users yet" decision above. It's worth knowing exactly *how* it bites on a non-empty database: the third migration's `ALTER TABLE "addresses" ADD CONSTRAINT ... FOREIGN KEY ("user_id") REFERENCES "user"("id")` will fail if any `addresses` row's `user_id` doesn't exist in the new (empty) `user` table — which every pre-existing row's will, since the old `users` table was just dropped. Applying this migration set against a dev database with leftover seed data required clearing `addresses` first for exactly this reason. A deployment carrying real rows in `addresses` (or any future table with a FK to `user`) needs a real data migration first — this ADR's migrations are not that.

### Fastify integration

`apps/backend/src/infra/auth/better-auth.ts` holds the `betterAuth(...)` instance (`drizzleAdapter`, `emailAndPassword`, `additionalFields`, `session.expiresIn` from `SESSION_EXPIRY_DAYS`, `emailVerification`). `apps/backend/src/infra/auth/mount.ts` mounts its handler at `/api/auth/*` in `app.ts`, replacing the old oRPC-mounted auth router. `apps/backend/src/infra/auth/session-guard.ts` replaces the old `auth.plugin.ts`: a `preHandler` calling `auth.api.getSession()` and populating `request.user`, registered in the same protected-scope encapsulation as before, preserving the shape `checkout`/`orders`/`addresses` already depend on.

Two integration details that would otherwise silently break things:

- **`database.generateId: false`** (under `advanced` in the config) is required — without it, Better Auth generates its own non-UUID id strings, which fail to insert into this schema's `uuid` primary-key columns. Postgres's `gen_random_uuid()` default handles id generation instead, matching this repo's existing convention.
- **Raw-body bridging**: `app.ts` already captures the raw request body via a custom content-type parser (for webhook signature verification), and by the time any route handler runs, Fastify has fully drained the request stream. Better Auth's `toNodeHandler` (which reads the stream itself) can't be used for this reason — `mount.ts` instead builds a Fetch `Request` directly from that already-captured raw body.

### Guest cart merge on login

The old system merged a guest cart (via a `cart_token` cookie) into the user's cart inside the *same* DB transaction as session creation — so a merge failure rolled back the whole login. Better Auth has no hook that runs inside its own session-creation transaction with cookie access, so this is now done via `hooks.after` (`createAuthMiddleware`, path-matched on `/sign-in/email` and `/sign-up/email`), reading/clearing the `cart_token` cookie and calling the existing `mergeGuestCart` after the session has already committed.

**Accepted trade-off**: a merge failure no longer aborts sign-in — it's logged and the guest cart is simply left unmerged. Given `mergeGuestCart` already swallowed its own errors before this change (login never failed *because* of a merge failure, even in the old same-transaction design), the practical behavior change is narrow: a merge failure and a session-creation failure landing in the exact same instant would no longer both roll back together. Judged an acceptable trade given Better Auth's hook model offers no alternative with cookie access.

### Frontend

The custom `AuthProvider`/`useAuth` context is deleted outright in favor of Better Auth's own `better-auth/react` client (`apps/web/src/lib/auth-client.ts`) — `useSession()`, `signIn.email()`, `signUp.email()`, `signOut()` used directly in `login.tsx`/`register.tsx`/`require-auth.tsx`/`root-layout.tsx`. The cart-cache-invalidation-on-login/logout side effect that lived in the deleted provider now lives in each call site.

The old provider carried a fix (`auth-context.tsx`, prior commit) for a race where a slow anonymous session check in flight at mount could resolve after a login and silently sign the user back out. Verified by reading Better Auth's client source (`session-atom.mjs`) before relying on it: every session fetch aborts the previous in-flight one via `AbortController`, and sign-in/sign-up/sign-out all trigger a fresh fetch through the same path — so the same race is closed by the library's own design, not by anything this migration had to re-implement.

### Known gaps, deliberately not solved here

- **`config` (jsonb) additionalField** has no native Better Auth field type for JSON; stored as `type: 'json'` (a real supported type, not a stringify workaround) but nothing reads it yet — deferred until a consumer exists.
- **`additionalFields` TypeScript inference** is incomplete in this version — `session-guard.ts` and `root-layout.tsx` cast defensively at the two points that read `firstName`/`lastName`/`isAdmin` off session data rather than getting full inference.
- **Email verification delivery is stubbed** — `sendVerificationEmail` only logs the link; no email provider exists in this repo yet. The verification flow is real and exercisable, just not delivering anything end-to-end.
- **The old plugin's distinct "session not found" vs "session expired" 401 messages are gone** — Better Auth's `getSession()` doesn't expose that distinction, so both collapse into one generic 401.
- **Registration on a duplicate email now returns HTTP 422** (Better Auth's stock `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`), not the old system's 409 — and, unlike the old system, explicitly discloses that the address is taken rather than obscuring it. This is stock Better Auth behavior, not something configured; narrowing it is a candidate for later, not addressed here.

The full spec is at `docs/specs/auth.md`.
