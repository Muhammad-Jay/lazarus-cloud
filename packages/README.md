# packages

All TypeScript logic. `apps/web` is composition only, so essentially everything
with behaviour lives here.

## Layout

| Package | Holds | Phase |
|---|---|---|
| `spec/` | `lazarus.schema.json`, generated TS types, validator | 2 |
| `contracts/` | **Generated only** — OpenAPI client, SignalR hub types | 16, 15 |
| `api-client/` | HTTP transport, `ProblemDetails` normalisation | 16 |
| `realtime/` | SignalR client, typed hub bindings, reconnection | 15 |
| `auth-client/` | Better Auth client, session hooks, permission gates | 18.1 |
| `ui/` | Design-system primitives | 17 |
| `lib-utils/` | `cn()`, formatters, shared guards | 17 |
| `testing/` | Vitest setup, Testing Library helpers, MSW handlers | 17 |
| `config/` | Shared tsconfig, ESLint, Prettier, Vitest presets | 17 |
| `feature-<x>/` | One package per product feature slice | 18 |

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

## Status

Not created yet. `spec/` lands in Phase 2; everything else in Phase 17.