# packages

All TypeScript logic. `apps/web` is composition only, so essentially everything
with behaviour lives here.

## Layout

| Package | Holds | Phase | State |
|---|---|---|---|
| `spec/` | `lazarus.schema.json`, generated TS types, validator | 2 | done |
| `contracts/` | Interaction + session schemas and their generated TS | 2 | done |
| `interaction/` | The interaction model: reducer, transcript, ranking, ANSI filter | 1 | done |
| `tokens/` | Every colour, spacing, radius, shadow, motion value | 3 | done |
| `api-client/` | HTTP transport, `ProblemDetails` normalisation | 5 | not started |
| `realtime/` | Execution event stream client, reconnection | 5 | not started |
| `auth-client/` | Better Auth client, session hooks, permission gates | 7 | not started |
| `ui/` | Design-system primitives | 4 | not started |
| `lib-utils/` | `cn()`, formatters, shared guards | 4 | not started |
| `testing/` | Vitest setup, Testing Library helpers | 4 | not started |
| `config/` | Shared tsconfig, ESLint, Prettier, Vitest presets | 4 | not started |
| `feature-<x>/` | One package per product feature slice | 4 | not started |

The first three rows are the ordering that matters. `tokens` and the interaction
core come before any UI, because `ColorRole` in the contract must resolve to a
token (Phase 3.2) — a component palette that drifts from the contract is the bug
this ordering prevents. Everything else is transport or presentation and can be
built once the model is real.

## Feature slices

A feature slice owns its state, hooks, validation, and presentation together:

```
packages/feature-deployments/
├── api.ts             # typed calls, no fetch
├── state.ts           # store
├── schema.ts          # zod schemas for forms
├── hooks/             # useDeployments, useDeploymentLogs, …
└── components/        # DeploymentsList, DeploymentCard, …
```

A slice may import from `api-client`, `realtime`, `auth-client`, `ui`, and
`lib-utils`. It may **not** import from another `feature-*` package. If two
features need the same thing, it belongs in `lib-utils` or a new shared package
(`AGENTS.md` §5 — one way to do a thing).

## Rules

- No `any`. No `@ts-ignore`. No `eslint-disable`. No empty `catch`.
- No `console.*` — each package uses its one logger wrapper.
- No hand-written `fetch` — go through `api-client`.
- No hand-edits in `contracts/`. Fix the generator.
- Dependencies come from the pnpm `catalog:` in `pnpm-workspace.yaml` so versions
  are pinned in one place.
- Package names are `@lazarus/<name>`.

## The graph

```
  apps/web          apps/desktop
       │                 │
       └────────┬────────┘
                ▼
        packages/feature-*
                │
                ▼
   packages/ui   packages/api-client  packages/realtime
        │              │                   │
        └──────┬───────┴───────────────────┘
               ▼
      packages/interaction   packages/tokens
               │                  ▲
               ▼                  │
        packages/contracts ───────┘
```

`tokens` and `contracts` are leaves that import nothing. `interaction` imports only
`contracts`. Nothing imports another package's `src/` — subpath exports are the
only door. A `feature-*` never imports another `feature-*`.

This graph is enforced by tests, not by review: `packages/interaction/test/framework-free.test.ts`
reads its own source and fails on a React import, a DOM global, or a
cross-package `src/` reach-in. A React import added to that package fails the suite.

## Status

`spec/`, `contracts/`, and `interaction/` are built and tested. `tokens/` is next.
The rest are transport and presentation, and Phase 4.1 has to settle the frontend
framework before any of them can be written — see the open decisions in
[`../TODO.md`](../TODO.md).