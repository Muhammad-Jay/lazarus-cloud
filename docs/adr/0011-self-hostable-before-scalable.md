# 0011 — Self-hostable before scalable

**Status:** Accepted
**Date:** 2026-10-02

## Context

Lazarus has two possible shapes, and they pull in opposite directions.

One is a hosted SaaS: multi-region, elastic, autoscaling control-plane, managed
Postgres, an external secret store, a queue. Operated by a team, with the cost
structure of a team.

The other is something one person installs on one machine with one command, and
operates alone. No account, no cloud provider, no cluster, no managed service.

Both are legitimate products. The question is which one comes first, because the
order determines almost every early decision: the schema, the tenancy model, the
event system, the deployment topology, and the TLS story all get harder to change
once chosen.

The previous implementation leaned hosted: Supabase for auth meant no installation
could run without a Supabase account. The repository also contained a
partially-built Kubernetes path — no tests, no design, never finished — which is the
tell. Someone started designing for a scale the product had not reached, and the
result was an unrunnable feature that consumed attention.

## Decision

**Self-hostability is a hard constraint that shapes the architecture from Phase 0.
Scalability is deferred explicitly, not optimistically.**

### Self-hostable is an acceptance criterion

- **One person, one machine, one command.** `infra/compose/` is the reference
  implementation and it is tested.
- **No mandatory external dependency.** Postgres, auth, TLS, and storage are all
  self-hosted. A hosted control plane is never required to run Lazarus.
- **The base domain is install-time configuration**, never a hardcoded constant. A
  default of `lazarus.dev` is a convenience in `.env.example` and nowhere else.
- **TLS degrades honestly.** Wildcard ACME with an owned domain; a self-signed CA
  and a LAN hostname without one; plain HTTP only in dev mode behind an explicit
  flag. No code path assumes a real certificate exists, and all three modes are
  tested.
- **Everything observable is optional-by-default.** OpenTelemetry exporters, Sentry,
  and similar degrade to no-ops, never to failures. Self-hosting must not mean
  "your data leaves the machine" — including telemetry.
- **A change that makes self-hosting harder needs an ADR.** It is a considered
  trade, not an accident.

### Deferral is explicit

- **Single-node only.** No horizontal control-plane scaling. This needs the durable
  outbox and a shared session store first, and pretending otherwise would be
  dishonest.
- **In-memory events are at-most-once**, accepted with the state machine designed to
  be reconcilable (`ADR-0003`).
- **No Kubernetes.** Not now, not later. Podman, rootless.
- **No multi-region.** The data model supports tenancy; the deployment model is one
  node.
- **No horizontal database.** Single Postgres, backed up and restored.

### The rule that makes deferral safe

Every deferred item is **written down with its cost**. This ADR, `SECURITY.md`
(known limitations), and `docs/threat-model.md` §5 (accepted risks) each state what
we are not doing and why. A deferral that nobody wrote down becomes a forgotten
weakness, and a forgotten weakness is a vulnerability waiting to be found.

## Consequences

### Positive

- **The install story is real.** One command, no cloud account. This is a genuine
  product differentiator and it is tested.
- **Decisions stay cheap.** Single-node means one transaction boundary, one process,
  and a deployment story anyone can reason about.
- **No speculative complexity.** No Kubernetes path, no service mesh, no multi-region
  bookkeeping — the three things that consumed the previous implementation.
- **Privacy by default.** Nothing leaves the machine unless the operator configures
  it.
- **The whole platform is debuggable by one person.** A single box with a compose
  file beats an architecture diagram.
- **A hostile operator question has an answer.** "Could Lazarus phone home?" is
  answerable by reading the compose file.

### Negative

- **Single-node means a single point of failure.** No HA, no failover. Accepted for
  the first release; mitigated by backups and the `restore-from-backup` runbook.
- **Throughput is bounded by one box.** Fine for the target user, wrong for a large
  SaaS. This is the real cost of the ordering.
- **Some security mechanisms are genuinely harder without scale-out.** Row-level
  security plus connection pooling needs care (`ADR-0005`), and it would be simpler
  with a connection-per-tenant model at a larger scale.
- **Operators own their own TLS, database, and backups.** We provide the compose
  file and the runbooks; we do not operate it for them. That is real support surface.
- **"No mandatory external dependency" constrains every design choice.** Policy as a
  library rather than an external engine (`ADR-0010`), events in-process rather than
  a broker (`ADR-0003`), and auth self-hosted rather than Supabase (`ADR-0004`) were
  all decided partly by this constraint.
- **Deferral must be actively maintained.** A stale `TODO.md` makes this ADR a
  comfort blanket rather than a decision.

### Neutral

- Multi-tenancy is designed in from the start even though a typical install has one
  tenant, because retrofitting it is one of the most expensive refactors there is
  (`ADR-0005`). The constraint and the design choice are independent.
- Horizontal scaling is not forbidden — it is unscheduled. An ADR superseding this
  one would be the correct way to do it.

## Alternatives considered

**Hosted SaaS first, self-hosting later.** Rejected: self-hosting is the harder and
more differentiating half, and retrofitting it into a hosted architecture means
removing hosted dependencies from every layer — auth, storage, telemetry, TLS. Doing
it second would mean doing it worse. The previous implementation chose this order
and needed Supabase forever.

**Self-hostable and horizontally scalable simultaneously.** Rejected as a false
economy. Doing both at once means building the durable outbox, a shared session
store, and distributed coordination before the product has a single working
deployment. Both halves would be worse for it.

**Kubernetes-first.** Rejected: it contradicts the one-command install requirement
outright. A self-hosted install would require a cluster before the product works,
which is the opposite of self-hosting. The previous repository's unfinished
Kubernetes path is evidence of what this costs.

**Offer both, without choosing.** Rejected: "supports self-hosting" as an
afterthought is the specific failure mode of the previous implementation. An
installation that technically runs on-prem but was designed around a hosted control
plane is not self-hostable; it is a hosted product with extra steps.

**A hosted control plane with a thin local agent.** Rejected: it makes an external
service mandatory, which is the constraint we are trying to satisfy, and it puts the
policy chokepoint across a network hop that can fail open.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §1 — self-hostable is a hard constraint
- [`../../SECURITY.md`](../../SECURITY.md) — known limitations
- [`../threat-model.md`](../threat-model.md) §5 — accepted risks
- [`../architecture.md`](../architecture.md) — deployment topology
- [`0003`](./0003-in-memory-domain-events.md) — at-most-once events
- [`0004`](./0004-better-auth-standalone-with-jwks.md) — self-hosted auth
- [`0005`](./0005-multitenant-row-level-security.md) — tenancy designed in early
- [`0008`](./0008-greenfield-rewrite.md) — no speculative Kubernetes path