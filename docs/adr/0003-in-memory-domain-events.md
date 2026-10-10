# 0003 — In-memory domain events

> **Note.** This decision stands, and its escape hatch is now load-bearing:
> execution lifecycle events are designated transitions that must not be lost,
> so they use the durable outbox rather than at-most-once in-memory dispatch.
> See
> [0013 — Discrete command executions](./0013-discrete-executions-no-pty.md).

**Status:** Accepted
**Date:** 2026-10-02

## Context

Modules are externally sealed (`ADR-0002`). When `Deployments` finishes a
container, `Endpoints` needs to allocate a port and `Observability` needs to record
an outcome. A direct call from one to another is exactly the coupling the module
boundary exists to prevent.

The alternative to an event is a direct reference. `Deployments` would take an
`IEndpointProvisioner` from `Lazarus.Application`, which is allowed. But that
interface grows: a new module that needs to react to a deployment adds a method to
a shared interface, every implementation changes, and the shared kernel slowly
becomes a service locator. Four modules reacting to one event means four edits and
no visibility into who reacts.

Events also serve a second purpose specific to this product: **auditability**. The
question "who deployed what, when, and what was decided" is answered by recording
state transitions as they happen, and the same mechanism can answer it.

The complication is transactional integrity. A domain event is usually raised
inside a `SaveChanges`, but a handler must not run until the transaction commits —
otherwise a handler can observe, and act on, state that is about to be rolled back.
Dispatch happens after commit, always.

## Decision

Modules publish **domain events** on an in-process bus. A handler reacts through
the bus and never calls another module.

Rules, in full:

- A domain event is a statement of fact in the past tense: `DeploymentStarted`,
  `ImageBuilt`, `EndpointProvisioned`. Never `DoBuild` or `PleaseBuild`.
- Handlers are **idempotent** and **retry-safe**. Assume delivery happens twice.
- Dispatch happens **after** commit. Never inside an open transaction.
- **A handler never holds a transaction open across a process spawn or a network
  call.**
- Events are part of a module's public API. Changing one is a breaking change for
  every subscriber.
- Handlers live in the reacting module, never in the publishing module.

Implementation: `Lazarus.EventBus`, an in-memory dispatcher resolved from DI,
using scoped handlers invoked after the ambient `DbContext` transaction commits.

### The durability limitation, stated plainly

In-memory dispatch is **at-most-once**. If the process dies between commit and
handler completion, the event is lost. A durable outbox is not built.

We accept this now because the deployment state machine is designed to be
**reconcilable**: a periodic worker compares desired state against observed state
and drives transitions to their goal. A lost event delays a transition; it does not
corrupt state. The trade is accepted explicitly rather than discovered during an
incident, and it is called out in [`../../SECURITY.md`](../../SECURITY.md) under
known limitations so a security reviewer is not misled.

A durable outbox is the correct fix, and it is deferred rather than dismissed. It
requires a table, a dispatcher with retry and dead-letter handling, and an ordering
guarantee per aggregate — a real project, not an afternoon.

## Consequences

### Positive

- Modules stay decoupled. Adding a reactor to a deployment touches no publishing
  code.
- The set of reactions to an event is visible by searching for handlers, which
  makes the audit story answerable.
- No network hop between modules, so the policy chokepoint cannot be bypassed by a
  service call failing.
- Handlers are independently testable against a fake bus.

### Negative

- **Events can be lost.** The main cost, stated in `SECURITY.md` and here.
- **No ordering guarantee** across modules, and no guarantee that a handler for
  `ImageBuilt` runs before a handler for `DeploymentStarted`.
- **Debugging requires tracing.** An action has several independent causes, so a
  log search is not sufficient; structured logging with a correlation id is
  required.
- **A handler failure fails the request.** After commit, a handler error cannot
  roll anything back, so it must be surfaced honestly rather than swallowed.

### Neutral

- Domain events are synchronous within the process. They do not queue, so they are
  not durable — see the limitation above.
- Publishing is explicit. Nothing discovers handlers by convention; the publisher
  does not know who listens.

## Alternatives considered

**Direct cross-module interface calls.** Rejected: permitted, but it grows into a
service locator as reacting modules accumulate, and the number of edits per new
reaction grows with it. Events make a new reaction local to the reacting module.

**Full event sourcing.** Rejected: substantial cost, and it does not buy anything
for this product. The audit requirement is answered by recording transitions, not
by reconstructing the entire past from events.

**A durable outbox immediately.** Rejected only as *sequencing*, not on merit: it
is the right long-term answer, and adding it before there is a second process to
coordinate with would add a table and a dispatcher with nothing to prove them. The
limitation is documented and tracked (`TODO.md` 17.2) rather than quietly deferred.

**RabbitMQ or NATS.** Rejected: a mandatory external broker would break
self-hostable-first (`ADR-0011`). If the outbox lands and a second process appears,
this decision is superseded.

**Outbox pattern only, no in-memory bus.** Rejected for now: an outbox with a
single-process dispatcher is the outbox plus extra moving parts. Revisit when a
handler must run in a different process.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §9 — events and side effects
- [`../../AGENTS.md`](../../AGENTS.md) §4.2 — module isolation
- [`0002`](./0002-dotnet-modular-monolith.md) — module boundaries
- [`../../SECURITY.md`](../../SECURITY.md) — known limitations
- [`../threat-model.md`](../threat-model.md) §5 — accepted risks
