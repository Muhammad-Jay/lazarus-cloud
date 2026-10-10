# apps/control-plane

The Lazarus control plane. .NET 10, modular monolith, Clean Architecture layers
with hard module boundaries.

## What belongs here

Everything the platform knows: tenancy, experiences, documents, sessions,
command execution, policy, and the adapters that reach podman.

## Layout

```
apps/control-plane/
├── Lazarus.sln
├── Directory.Build.props            # shared compiler + nullable settings
├── Directory.Packages.props         # central package management
├── src/
│   ├── Lazarus.Domain/              # shared kernel primitives ONLY
│   ├── Lazarus.Application/         # cross-module contracts ONLY, no impls
│   ├── Lazarus.EventBus/            # in-process domain event dispatch
│   ├── Lazarus.Infrastructure/      # DbContext, migrations, queries, OTel
│   ├── Lazarus.Api/                 # host, DI wiring, middleware, health
│   └── Modules/
│       ├── Tenancy/                 ┐
│       ├── Identity/                 │
│       ├── Experiences/              │
│       ├── Documents/                 │
│       ├── Sessions/                  │
│       ├── Exec/                     │  each module owns its domain
│       ├── Policy/                   │
│       ├── Secrets/                  │
│       ├── Runtime/                  │  podman adapter
│       └── Observability/            │
└── tests/
    ├── Lazarus.Architecture.Tests/  # NetArchTest — boundary enforcement
    ├── Lazarus.EventBus.Tests/
    ├── Lazarus.Api.Tests/
    └── Modules/*/
```

## The rules that matter most

- `Lazarus.Domain` references nothing and holds only primitives — never a
  business aggregate (`AGENTS.md` §4.4).
- A module never references a sibling module. Cross-module interaction is a DTO
  in `Lazarus.Application` or a domain event on the bus (§4.2).
- Controllers translate HTTP to one Application call. No business logic, no EF
  (§4.3).
- No container, image, exec, filesystem, or network operation runs without a
  `PolicyEvaluator` decision (§4.5). This is enforced by an architecture test, not
  by review.
- The interaction model lives in `packages/interaction`, not here (§4.8).

## Status

Not created yet. Lands in Phase 6 of `TODO.md`.

## Local run

```sh
dotnet run --project src/Lazarus.Api
```

Requires Postgres. `just dev-up` brings up the full stack.
