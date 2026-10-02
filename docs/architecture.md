# Architecture

How Lazarus is put together, and why. For the rules that govern changes, read
[`AGENTS.md`](../AGENTS.md). For the decision behind any specific choice, read the
ADR cited in the margin. For a module's own boundaries, read
[`docs/modules/`](./modules/).

## Context

Lazarus needs to take a declaration — a spec, a form submission, a JSON payload
from an AI agent — and turn it into a running, publicly reachable container. That
is an untrusted-input-to-code-execution path, and it is the product. The
architecture exists to make that path survivable.

Three facts shape everything:

1. **The input is hostile.** A spec arrives from an AI agent as often as from a
   human. It must be treated as hostile even when the caller is authenticated.
2. **The consequence is code execution.** A container that escapes takes the
   host. There is no partial failure.
3. **The operator is one person.** A hosted control plane may exist one day. The
   product may never require one.

## Components

```
                    ┌──────────────┐
  browser ─────────►│              │
  Go CLI ──────────►│  apps/web    │  Next.js 16, composition only
  AI agent ────────►│              │
  (JSON + key)      └──────┬───────┘
                           │ server-side session cookie
                           ▼
                    ┌──────────────┐        ┌──────────────────┐
                    │  services/   │        │  apps/cli        │
                    │  auth        │◄──────►│  Go CLI          │
                    │  Better Auth │  JWKS  └──────────────────┘
                    └──────┬───────┘
                           │ ES256 tokens, local verification
                           ▼
              ┌────────────────────────────────┐
              │  apps/control-plane            │
              │  .NET 10, modular monolith    │
              │  ┌──────────────────────────┐  │
              │  │  Api                     │  │  REST + SignalR
              │  │  ├─ Infrastructure       │  │  EF, outbox, tenancy
              │  │  ├─ Modules/*            │  │  15 modules
              │  │  ├─ Application  ◄───────┼──┼── DTOs across modules
              │  │  └─ Domain        ◄───────┼──┼── shared primitives
              │  └──────────────────────────┘  │
              └───────────────┬────────────────┘
                              │ all podman access behind PolicyEvaluator
                              ▼
              ┌────────────────────────────────┐
              │  rootless podman               │
              │  build · run · exec · ports    │
              └───────────────┬────────────────┘
                              ▼
              ┌────────────────────────────────┐
              │  Edge (Caddy)                  │
              │  subdomain → port, wildcard TLS│
              └────────────────────────────────┘
```

### apps/web — Next.js 16

Composition only. Routes, layouts, server components, provider wiring. It contains
no business logic, no data access, and no state machines. Everything it needs is
a function in `packages/`.

This is enforced by convention and reviewed, not by a test — a Next.js app that
imports a database client is the usual failure mode, and the convention is what
keeps the client bundle honest.

### apps/control-plane — .NET 10

The engine. A modular monolith, because the modules share one process, one
database, and one transaction boundary, and splitting them across processes would
buy latency and operational cost in exchange for a boundary we can enforce in CI.

The layer graph (`AGENTS.md` §4.1) points inward:

```
Api  →  Application  →  Domain
                        ↑
              Infrastructure
```

`Lazarus.Domain` references nothing — no project, no framework. It holds eight
types and no business aggregates. That is the whole point: the shared kernel is
small enough that promoting something into it means two modules need it, which
usually means it is two things.

### services/auth — Better Auth

The trust root, and deliberately not inside the control plane. It is a separate
service on its own Postgres schema, so that a control-plane compromise does not
grant the attacker the ability to mint tokens.

It issues asymmetric ES256 JWTs and publishes a JWKS document. Consumers verify
locally. No request to Lazarus ever needs to reach the auth service to be
authenticated, which means auth can be temporarily unavailable without taking the
platform down.

A user of `apps/web` gets a server-side session cookie instead. Same identity,
different transport. No browser ever holds a token.

### apps/cli — Go

A static binary. Users' automation runs in their shell, so it must be
dependency-free, start instantly, and work without a Node runtime on the machine.

### Edge — Caddy

Automatic certificates, wildcard when the operator owns a domain, self-signed
when they do not. Reverse proxy subdomain → allocated container port.

Caddy is chosen because the TLS story is the requirement, and Caddy solves it
without configuration. See [`ADR-0006`](./adr/0006-subdomain-wildcard-tls.md).

## Cross-cutting concerns

### Tenancy

Tenant identity comes from the validated token and nowhere else — never a body,
a query parameter, or a URL segment. A caller may never choose their tenant.

Every tenant-scoped table carries `tenant_id`, and Postgres row-level security
provides a second, independent enforcement. Application filtering and RLS must
both fail for a cross-tenant read to succeed. See
[`ADR-0005`](./adr/0005-multitenant-row-level-security.md).

### Policy

The single most important design decision in the platform.

Every container, image, port, exec, volume, and network operation requires a
`PolicyEvaluator` decision first. Policy only ever subtracts: it can deny a
capability, and it cannot grant one. No spec field, request payload, or operator
flag can override it.

The strongest part of the design is not the chokepoint but the schema. The spec
has **no field** for privileged mode, host mounts, host networking,
`docker.sock`, added capabilities, or host namespaces. They are not
"administrator-only" or "off by default" — they are unexpressible, so they
cannot be requested. See
[`ADR-0010`](./adr/0010-policy-as-mandatory-chokepoint.md).

Runtime and Exec code reachable without a policy decision is a build failure,
caught by an architecture test.

### The spec as contract

`packages/spec/lazarus.schema.json` is authoritative. One schema generates
TypeScript, C#, and Go types. Regeneration and its commit are required in the same
PR, enforced by the `contract-drift` CI check.

This removes an entire class of bug — three implementations of "what a port means"
drifting apart — by making it structurally impossible to have three.

### Events

Modules never reference each other. They publish domain events on an in-process
bus and react to each other's events. Dispatch happens after commit.

In-memory dispatch is at-most-once: a crash between commit and handler completion
loses an event. This is accepted for now because the deployment state machine is
designed to be reconcilable, and a durable outbox is not built yet. The limitation
is documented in [`ADR-0003`](./adr/0003-in-memory-domain-events.md) and called out
in `SECURITY.md` rather than left for someone to discover.

### Secrets

A spec names a secret; it never carries one. Values are encrypted at rest with
`LAZARUS_MASTER_KEY`, redacted in every log and error message, and never returned
by any API. Backups of the database are useless without the master key, which is
why losing it is unrecoverable by design.

### Observability

Structured Serilog logging through `ILogger<T>`. OpenTelemetry exporters, Sentry,
and similar are optional and degrade to no-ops. Self-hosting is not allowed to
mean "your data leaves the machine" — that includes telemetry.

## Request paths

### Launch a container

```
POST /v1/automations            { spec, options }
  → Auth:      validate JWT, resolve tenant from claims
  → Specs:     validate against schema, normalise
  → Policy:    evaluate; any denial → 403, nothing else runs
  → Secrets:   resolve references to values in memory only
  → Runtime:   pull allowlisted digest-pinned image
  → Runtime:   create container, all caps dropped, cgroup limits applied
  → Endpoints: allocate port, Edge config updated
  → Deployments: record attempt, publish DeploymentStarted
  ← 202 + { deploymentId, logStreamUrl }
```

Every step is behind Policy. Every step is audited. `DeploymentStarted` is
dispatched after commit.

### Attach a terminal

```
ws(s)://<control-plane>/hubs/exec?deploymentId=…
  → Auth:   validate token during the SignalR handshake
  → Policy: evaluate attach capability (allowed, TTL, resource limits)
  → Exec:   allocate a pty in the container
  →        group-scope every send to (tenantId, actorId)
  → Audit: record actor, tenant, container, expiry
```

### Push to main

```
GitHub push → webhook (signature verified)
  → Automation: create pipeline run, mark source revision
  → Releases:  build image from spec
  → Policy:    evaluate before every build and run step
  → Deployments: deploy, publish events
  → Endpoints: re-point the subdomain (zero downtime where possible)
```

## Deployment topology

A single-box installation:

| Component | Runtime | Notes |
|---|---|---|
| Edge | Caddy | TLS, subdomain routing, static termination |
| Auth | Node (Better Auth) | `services/auth` |
| Control-plane | .NET 10 | ASP.NET Core, Kestrel |
| Database | Postgres 17 | Single instance, RLS enabled |
| Containers | rootless podman | Per-tenant, no host namespaces |
| Source storage | filesystem | Under `LAZARUS_DATA_DIR` |

`infra/compose/` is the reference implementation. One-command install is an
acceptance criterion, not an aspiration (`AGENTS.md` §1).

Scaling is deliberately not addressed. Horizontal control-plane scaling needs the
durable outbox and a shared session store first, and pretending otherwise would
be dishonest. See [`ADR-0011`](./adr/0011-self-hostable-before-scalable.md).

## What this architecture is not

Anti-goals, restated because they get reintroduced by accident
(`AGENTS.md` §1):

- **No flow/node/graph editor.** No canvas, no `reactflow`, no `@xyflow/react`.
- **No document or collaborative editing product.** That line was closed and its
  code deleted.
- **Not a general Docker or Kubernetes orchestrator.** No cluster management, no
  arbitrary image deployment, no scheduler.
- **Not a general CI provider.** The pipeline builds and deploys the user's spec.
- **Not a cloud IDE.** A terminal is a feature.
- **Not a SaaS.** Nothing in the architecture assumes a hosted control plane, and
  `lazarus.dev` is a value in `.env.example`, not a constant in code.

## Further reading

| Document | Contents |
|---|---|
| [`docs/threat-model.md`](./threat-model.md) | Trust boundaries, adversaries, known limitations |
| [`docs/spec-reference.md`](./spec-reference.md) | The spec contract, once written (Phase 2) |
| [`docs/modules/`](./modules/) | Per-module ownership boundaries |
| [`docs/runbooks/`](./runbooks/) | Operational procedures |
| [`docs/adr/`](./adr/) | Decisions, with context and consequences |
| [`AGENTS.md`](../AGENTS.md) | Binding working rules |
| [`TODO.md`](../TODO.md) | Phased plan and current state |