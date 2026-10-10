# 0002 — .NET 10 modular monolith for the control plane

**Status:** Accepted
**Date:** 2026-10-02

## Context

The control plane owns the whole product lifecycle: parse a spec, evaluate
policy, build an image, create a container, allocate ports, drive a pipeline,
proxy a terminal. It is the security-critical component, and every one of those
operations needs a transaction, an audit record, and a policy decision in the
same breath.

Those three requirements — atomic state changes, consistent audit, and one
authorisation chokepoint — argue strongly for a single process. Splitting them
across services means either distributed transactions or accepting that a
deployment is recorded without its audit row, which for this product is not a
trade worth making.

The team is one to three people. The previous implementation ran two Node
backends, a Supabase dependency, and a partially-built Kubernetes path, and none
of it worked together.

Meanwhile the actual hard problems here are not distributed-systems problems. They
are: can a hostile spec reach a privileged operation, and can one tenant's data
ever become another's. Both are questions about *code structure*, not about
network boundaries.

The technology choice also has to survive self-hosting: one person, one machine,
one command. A runtime that needs a message broker, a service mesh, or a
schema registry to run correctly is disqualified on first principles.

## Decision

The control plane is a **single deployable .NET 10 modular monolith**, laid out
as Clean Architecture with dependencies pointing inward.

```
Api  →  Application  →  Domain
                        ↑
              Infrastructure
```

- `Lazarus.Domain` references nothing. No project, no framework.
- `Lazarus.Application` references `Lazarus.Domain` only, and holds cross-module
  contracts as DTOs and interfaces.
- `Lazarus.Infrastructure` holds the `DbContext`, migrations, tenancy resolution,
  and external clients.
- `Lazarus.Api` is the host: DI wiring, middleware, health endpoints, and nothing
  else.

Each business module (`Policy`, `Runtime`, `Deployments`, `Endpoints`, …) is three
class libraries — `Lazarus.Modules.<M>.Domain`, `.Application`, `.Api` — and is
externally sealed. A module never references another module's `Domain`,
`Application`, or `Infrastructure`. Cross-module interaction is a domain event on
the bus, or a DTO declared in `Lazarus.Application`.

Controllers are translation only: bind, validate, call exactly one Application use
case, map the result. A controller over roughly 40 lines has logic in the wrong
place.

`dotnet format`, `dotnet build -warnaserror`, and NetArchTest architecture tests
enforce the layering.

## Consequences

### Positive

- **One transaction boundary.** A deployment, its audit row, and its port
  allocation commit atomically. No saga, no outbox for the common path.
- **One authorisation chokepoint.** Policy is a library call, not a network hop,
  so it cannot be bypassed by a service mesh outage or a misconfigured timeout.
- **Enforced boundaries.** Module isolation is an architecture test. A cross-module
  reference fails the build, which is stronger than a review comment.
- **Deployable in one process.** Self-hosting stays one command; there is no
  orchestrator to install first.
- **Refactorability.** Extracting a module into a service later is a mechanical
  change if measurement ever justifies it, because the boundary already exists.

### Negative

- **Coupling at deploy time.** Every module ships together. A policy bug takes the
  dashboard down with it.
- **Scaling is uniform.** The web surface and the podman-bridging surface scale
  together, which is wrong in both directions.
- **Memory pressure is shared.** A busy terminal session competes with the
  pipeline for the same heap.
- **A large solution to navigate.** Roughly 50 projects; the dependency graph is
  the price of the boundary.

### Neutral

- Module boundaries are enforced in tests, not by the runtime. A `public` member in
  a module is visible at compile time and forbidden by convention plus
  architecture tests.
- Monolith does not mean unstructured. The module graph is strict; only the
  deployment topology is unified.

## Alternatives considered

**Microservices per module.** Rejected: it directly contradicts the single
transaction boundary, and it makes self-hosting require a service mesh or an
orchestrator — which the self-hostable constraint (`ADR-0011`) forbids outright.

**A modular monolith with no per-module projects** (one big `.Domain`). Rejected:
without separate assemblies, module isolation is a naming convention. The separate
project files are the mechanism that makes an architecture test possible at all.

**Node.js/TypeScript for the control plane.** Rejected on the previous
implementation's own evidence: two backends, duplicated domain logic, drift
between them. Compile-time enforcement of layering and nullability is the specific
capability that would have caught it. .NET's nullable reference types and sealed
module assemblies are the reasons for the choice, not general performance.

**Go for the control plane.** Genuinely competitive, and it is what we use for the
CLI. Rejected: `async`/await with cancellation, structured concurrency, and
`System.Text.Json` source generation made the orchestrating code materially cleaner
in C#. The CLI is I/O-bound and benefits from a dependency-free binary; the control
plane benefits from structure.

**Rust.** Rejected: async ergonomics and compile times would slow the team down
without changing the architecture, and the build-sandbox requirement would still
need a separate process.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §2 — architecture at a glance
- [`../../AGENTS.md`](../../AGENTS.md) §4.1 — layer direction
- [`../../AGENTS.md`](../../AGENTS.md) §4.2 — module isolation
- [`../../AGENTS.md`](../../AGENTS.md) §4.3 — controllers are translation only
- [`../architecture.md`](../architecture.md) — components
- [`0001`](./0001-record-architecture-decisions.md) — recording decisions
