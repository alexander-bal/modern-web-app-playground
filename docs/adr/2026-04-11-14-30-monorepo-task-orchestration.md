# Monorepo Task Orchestration with Turborepo

**Status:** accepted
**Date:** 2026-04-11 14:30

## Context

The Mercado monorepo (`mercado-monorepo`) contains three workspace packages:

```
apps/backend/       → @mercado/backend   (Fastify, TypeScript, Vitest)
apps/web/           → @mercado/web       (React, Vite, Playwright)
packages/api-contracts/ → @mercado/api-contracts (ts-rest + Zod schemas)
```

Task orchestration is currently handled by raw pnpm workspace commands and manually sequenced scripts. This creates two concrete problems:

**1. Manual dependency ordering in scripts.** `@mercado/backend` depends on `@mercado/api-contracts`, so `build` in `package.json` is written as:

```json
"build": "pnpm build:contracts && pnpm --filter @mercado/backend build"
```

Every cross-package script must manually encode the dependency graph with `&&`. Adding a new package (e.g., `@mercado/shared-utils`) requires updating every root script that touches the build chain.

**2. No task caching.** Every CI run and local build re-executes all tasks from scratch. The `static-checks` job in `.github/workflows/ci.yml` runs format, lint, typecheck, type-coverage, build, audit, spell check, and knip sequentially — even when only backend code changed. There is no mechanism to skip unchanged work.

**3. No parallel task execution.** The `lint` script runs biome and eslint sequentially:

```json
"lint": "pnpm run lint:biome && pnpm run lint:eslint"
```

These tasks are independent and could run in parallel, but pnpm workspace scripts have no built-in parallel orchestration with dependency awareness.

## Decision

Adopt **Turborepo** (`turbo`) as the monorepo task orchestrator. Turborepo SHALL be added as a root devDependency. A `turbo.json` configuration SHALL define the task dependency graph, caching rules, and parallel execution strategy.

### Target `turbo.json`

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint:biome": {
      "outputs": []
    },
    "lint:eslint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": [],
      "inputs": ["src/**", "tests/**", "test/**"],
      "env": ["DATABASE_URL", "NODE_ENV"]
    },
    "test:coverage": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "tests/**", "test/**"],
      "env": ["DATABASE_URL", "NODE_ENV"]
    },
    "type-coverage": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Key semantics:
- `"dependsOn": ["^build"]` — run the `build` task in all upstream dependencies first (`@mercado/api-contracts` builds before `@mercado/backend`)
- `"outputs": ["dist/**"]` — Turborepo caches these directories and restores them on cache hit
- `"inputs": ["src/**", ...]` — only these files affect the cache key; changes to unrelated files do not invalidate
- `"cache": false` — side-effectful tasks (migrations, dev servers) are never cached

### Root `package.json` script changes

Before (manual ordering):

```json
{
  "build": "pnpm build:contracts && pnpm --filter @mercado/backend build",
  "lint": "pnpm run lint:biome && pnpm run lint:eslint",
  "typecheck": "pnpm --filter @mercado/backend typecheck"
}
```

After (Turborepo orchestration):

```json
{
  "build": "turbo run build",
  "lint": "turbo run lint:biome lint:eslint",
  "typecheck": "turbo run typecheck",
  "test": "turbo run test",
  "test:coverage": "turbo run test:coverage"
}
```

Turborepo reads the workspace dependency graph from `pnpm-workspace.yaml` and each package's `dependencies`/`devDependencies`. No manual `&&` sequencing is needed.

### CI changes

The `static-checks` job in `.github/workflows/ci.yml` SHALL use Turborepo with remote caching disabled (local `.turbo` cache only, restored via `actions/cache`):

```yaml
- name: Cache turbo
  uses: actions/cache@v4
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
    restore-keys: |
      turbo-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-

- name: Build
  run: turbo run build

- name: Static checks
  run: turbo run typecheck lint:biome lint:eslint type-coverage
```

Turborepo runs `typecheck`, `lint:biome`, `lint:eslint`, and `type-coverage` in parallel (respecting `dependsOn` constraints). Unchanged packages produce cache hits.

### File structure after adoption

```
mercado-monorepo/
├── turbo.json                    # NEW — task graph and caching config
├── package.json                  # MODIFIED — scripts use `turbo run`
├── pnpm-workspace.yaml           # UNCHANGED
├── .gitignore                    # MODIFIED — add .turbo
├── apps/
│   ├── backend/package.json      # UNCHANGED — tasks defined per-package
│   └── web/package.json          # UNCHANGED
└── packages/
    └── api-contracts/package.json # UNCHANGED
```

### Configuration resolution chain

Turborepo resolves the task graph through this file chain:

```
turbo.json                          # defines tasks, dependsOn, inputs, outputs
  → pnpm-workspace.yaml            # discovers workspace packages (apps/*, packages/*)
    → apps/backend/package.json     # reads "dependencies": { "@mercado/api-contracts": "workspace:*" }
    → packages/api-contracts/package.json  # reads "scripts": { "build": "tsc" }
```

When `turbo run build` executes:
1. Turbo reads `turbo.json` → finds `build` task with `"dependsOn": ["^build"]`
2. Turbo reads `pnpm-workspace.yaml` → discovers `@mercado/backend`, `@mercado/web`, `@mercado/api-contracts`
3. Turbo reads each `package.json` → builds dependency graph: `@mercado/backend` depends on `@mercado/api-contracts`
4. Turbo executes `@mercado/api-contracts` `build` first, then `@mercado/backend` `build` in parallel with `@mercado/web` `build`

### Installation

```bash
pnpm add -Dw turbo
```

The `turbo` binary is the only new dependency. No runtime dependencies are added.

## Consequences

### Positive

- **Automatic dependency ordering.** Adding new workspace packages requires zero changes to root scripts — Turborepo infers the graph from `package.json` dependencies.
- **Local and CI caching.** Repeated `turbo run build` skips unchanged packages. On a typical PR touching only backend code, `@mercado/api-contracts` build is a cache hit (~0s vs ~3s).
- **Parallel execution.** Independent tasks (`lint:biome`, `lint:eslint`, `typecheck`) run concurrently. With 3 independent lint/check tasks that each take 5-15s, parallel execution reduces the wall-clock time from sequential sum (~30s) to the duration of the slowest task (~15s).
- **Zero per-package config.** Unlike Nx, Turborepo requires no `project.json` per package. It reads the existing `pnpm-workspace.yaml` and `package.json` scripts — the per-package files remain unchanged.
- **Single config file.** The entire task graph is defined in one `turbo.json` at the root.

### Negative

- **New devDependency.** `turbo` adds ~15MB to `node_modules`. This is a Rust binary, not a JavaScript dependency tree.
- **Learning curve.** Developers must understand `dependsOn`, `^` topology operator, and `inputs`/`outputs` for cache correctness. Misconfigured `inputs` can cause stale cache hits.
- **Opaque caching.** When a task unexpectedly produces a cache hit (or miss), debugging requires `--dry` and `--summarize` flags. This is a new debugging surface.
- **Remote caching not adopted.** This decision uses local caching only. Turborepo's remote cache (Vercel or self-hosted) is deferred — the monorepo's 3 packages do not justify the infrastructure cost.

### AI-Friendliness Impact

- **Discoverability: 5/5** — Single `turbo.json` at root; an LLM searching for "build", "task", or "pipeline" finds it immediately.
- **Cohesion: 5/5** — All task orchestration in one file instead of scattered across root `package.json` script chains.
- **Pattern consistency: 4/5** — Introduces a new tool, but follows the existing pattern of root-level config files (`biome.json`, `pnpm-workspace.yaml`). Deduction: LLMs must learn Turborepo semantics.
- **Type coverage: N/A** — No type-level changes.
- **Traceability: 5/5** — `turbo.json` explicitly declares which files are inputs and outputs for each task. An LLM can determine what a task depends on without reading script implementations.

**Overall AI-friendliness: 4.75/5**

## Options Considered

### Option A: Turborepo (recommended)

**How it works:** A Rust-based task runner that reads the pnpm workspace graph and executes package scripts in topological order with content-addressed caching. Configuration is a single `turbo.json` file. No per-package configuration files required.

**Trade-offs:**
- Pro: Zero per-package config, works directly with pnpm workspaces
- Pro: Content-addressed caching with granular `inputs`/`outputs` control
- Pro: Single ~15MB Rust binary, no transitive JS dependencies
- Con: Cache debugging requires Turborepo-specific knowledge (`--dry`, `--summarize`)
- Con: Remote caching ties to Vercel infrastructure (or self-hosted alternative)

**AI-friendliness: 4.75/5** — Single config file, explicit task graph, no magic conventions.

### Option B: Nx

**How it works:** A full-featured monorepo toolkit with project graph analysis, affected-command detection, and distributed task execution. Requires `nx.json` at root and `project.json` per package.

**Why not chosen:**
- Requires `project.json` in every workspace package (3 additional config files) — adds per-package configuration overhead for a 3-package monorepo
- `nx init` generates a `nx.json` with plugins and implicit dependencies that are opaque to LLMs
- Nx's "affected" command is powerful for large monorepos (50+ packages) but over-engineered for 3 packages
- Larger dependency footprint (~50MB+ with plugins) compared to Turborepo's single binary
- Nx's project graph visualization and caching infrastructure assume a scale this monorepo does not have

**AI-friendliness: 3.5/5** — Scattered config across `nx.json` + per-package `project.json`. Plugin system adds implicit behavior that LLMs cannot discover from file structure alone.

### Option C: Lerna

**How it works:** Monorepo publishing tool (now maintained by Nx). Task running is delegated to Nx under the hood.

**Why not chosen:** Mercado packages are private and not published to npm — Lerna's core value (versioning/publishing) is irrelevant. Modern Lerna inherits Nx's per-package config overhead and requires 3 config files (`lerna.json` + `nx.json` + per-package `project.json`).

**AI-friendliness: 3.0/5** — Multiple config layers. An LLM must understand Lerna's relationship to Nx to reason about task execution.

### Option D: Plain pnpm workspaces (status quo)

**How it works:** pnpm's built-in `--filter` and `--workspace-concurrency` flags for running scripts. Manual `&&` chains for dependency ordering. No caching.

**Why not chosen (as a long-term solution):**
- Manual dependency ordering is error-prone and does not scale beyond 3 packages
- No task caching — every run is a full rebuild
- `pnpm run --parallel` runs tasks concurrently but has no dependency awareness (cannot express "build contracts before backend")
- Adding a new workspace package requires auditing and updating every root script that touches the build chain

**AI-friendliness: 4.0/5** — No extra config files (good), but task dependencies are implicit in `&&` chains spread across `package.json` scripts (bad for discoverability).

## Migration Path

1. **Install Turborepo.** Run `pnpm add -Dw turbo`. Add `.turbo` to `.gitignore`. Verify `turbo --version` works.

2. **Create `turbo.json`.** Add the configuration shown in the Decision section. Run `turbo run build` and verify it builds `@mercado/api-contracts` before `@mercado/backend` without manual sequencing.

3. **Update root `package.json` scripts.** Replace these scripts with `turbo run` equivalents: `build`, `lint`, `typecheck`, `test`, `test:coverage`, `type-coverage`. Keep single-target pass-through scripts unchanged — these SHALL remain as `pnpm --filter`: `db:*`, `dev`, `dev:web`, `start`, `test:smoke`, `test:e2e`, `knip`, `openapi:*`. Run all modified scripts to verify behavior matches.

4. **Update CI workflow.** Add `actions/cache` for `.turbo` directory. Replace direct `pnpm --filter` calls with `turbo run` where task caching applies. Keep database-dependent jobs (`tests`, `smoke-test`, `e2e`) using direct `pnpm --filter` for side-effectful tasks.

5. **Update `AGENTS.md` and `Makefile`.** Document the `turbo run` commands. Update the Makefile targets that invoke root scripts to use the new script names if any changed.

6. **Verify.** Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm typecheck`. Run `turbo run build` twice — the second run SHALL produce a cache hit for all packages ("FULL TURBO" output).
