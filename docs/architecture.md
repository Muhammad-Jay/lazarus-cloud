# Architecture

How Lazarus is put together, and why. For the rules that govern changes, read
[`AGENTS.md`](../AGENTS.md). For the decision behind any specific choice, read the
ADR cited in the margin. For a module's own boundaries, read
[`docs/modules/`](./modules/).

## Context

Lazarus turns documentation into something a user reads and runs real commands
against. That is an untrusted-input-to-code-execution path, and it is the
product. The architecture exists to make that path survivable.

Four facts shape everything:

1. **The input is hostile.** An experience arrives from a creator, and a command
   arrives from a user or from an AI agent acting for one. All are hostile, even
   when authenticated.
2. **The consequence is code execution.** A container that escapes takes the
   host. There is no partial failure.
3. **The output is real.** A user is reading what a program actually printed. We
   never fabricate, sample, or prettify it.
4. **The operator is one person.** A hosted control plane may exist one day. The
   product may never require one.

## Components

```
   browser ─────────►│              │
   Go CLI ──────────►│  apps/web    │  Next.js 15, composition only
   AI agent ────────►│              │
   (JSON + key)      └──────┬───────┘
                            │ server-side session cookie
                            ▼
                     ┌──────────────────┐
                     │  services/auth   │  Better Auth
                     │  ES256 · JWKS    │
                     └────────┬─────────┘
                              │ validates locally
              ┌─────────────────┴─────────────────┐
              │                                   │
  apps/web validates          apps/control-plane validates
  locally (session)           locally (JWT ← JWKS)
              │                                   │
              │                               ┌───────────────────────┐
              │                               │ rootless podman       │
              │                               │ exec · stream · cancel│
              └──────────────────────────────►│ behind PolicyEvaluator │
                                              └───────────────────────┘

  apps/desktop (Tauri) ──► packages/interaction ◄── apps/web
```

### apps/web — Next.js 15

Composition only. Routes, layouts, page composition, provider wiring. It contains
no business logic, no data access, no state machines, no validation, and no
hand-written API clients. Everything it needs is a function or a type in
`packages/`.

The interesting dependency is `packages/interaction`, which holds the entire
interaction model as a pure reducer. `apps/web` binds it to React with a thin
`useReducer` plus transport and storage wiring.

### packages/interaction — the interaction model

The only place the interaction model exists. It imports `@lazarus/contracts` and
**nothing else**: no React, no DOM, no transport, no styling, no timers.

It owns the state shape, the pure reducer, transcript normalisation, execution
event application, suggestion ranking, draft-conflict resolution, and block
ordering. This is what makes `apps/desktop` a new client rather than a
rewrite — see [`ADR-0014`](./adr/0014-framework-free-interaction-core.md) and
`AGENTS.md` §4.8.

### packages/tokens — the design system source of truth

Semantic tokens only. No dependencies. All visual values in the frontend must
come from tokens. Raw colours, arbitrary values, or visual inline styles are
banned.

### apps/control-plane — .NET 10

Modular monolith following Clean Architecture. Domain → Application → Api, with
Infrastructure and EventBus. Hard module boundaries: no sibling module imports.
PolicyEvaluator is the chokepoint for all runtime operations.

### services/auth — Better Auth

Standalone identity provider. Issues ES256 JWTs and exposes JWKS. Clients
validate locally; the control plane does not call auth per request.

### apps/cli — Go 1.26

Thin client. No business logic or policy enforcement. Calls the control-plane
API and renders results.

## Package graph (frontend)

Dependencies point down and inward. Enforced by lint.

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

## Self-hosting promise

- One command (`just dev-up`) to start. No mandatory hosted control plane.
- The base domain is install-time configuration, not hardcoded.
- TLS degrades honestly: wildcard ACME if owned domain, else self-signed CA +
  LAN hostname. Plain HTTP in dev.
- Observability is optional-by-default and never blocks startup.

## Anti-goals

These are not Lazarus (from `AGENTS.md` §1):

- Not a terminal emulator. No PTY, no `xterm.js`, no `node-pty`.
- No flow/node/graph editor.
- No CI pipeline.
- Sessions are not published.
- Not a cloud IDE or dev workspace.
- Not an output simulator. We never fabricate, infer, or prettify output.
- Not a general Docker or Kubernetes orchestrator.
- Not a collaborative or long-lived document store.
- Not a SaaS — self-hostable is required.

## Further reading

| Document | Contents |
|---|---|
| [`docs/threat-model.md`](./threat-model.md) | Trust boundaries, adversaries, known limitations |
| [`docs/experience-reference.md`](./experience-reference.md) | The experience contract a creator publishes |
| [`docs/contracts-reference.md`](./contracts-reference.md) | The interaction and session contracts we own |
| [`docs/modules/`](./modules/) | Per-module ownership boundaries |
| [`docs/runbooks/`](./runbooks/) | Operational procedures |
| [`docs/adr/`](./adr/) | Decisions, with context and consequences |
| [`AGENTS.md`](../AGENTS.md) | Binding working rules |
| [`TODO.md`](../TODO.md) | Phased plan and current state |
