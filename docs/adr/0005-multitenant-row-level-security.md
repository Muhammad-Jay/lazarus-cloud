# 0005 — Multi-tenancy with row-level security

**Status:** Accepted
**Date:** 2026-10-02

## Context

Lazarus is multi-tenant from the first commit. An operator runs it for themselves,
occasionally for a team, and eventually for paying customers on one installation.
Multi-tenancy retrofitted into a single-tenant schema is one of the most expensive
refactors in software, because there is no correct place to add a filter you
forgot.

So the question is not *whether* but *how*, and the answer must survive contact with
a codebase written by several people over months.

The failure mode is specific and well known: someone writes a query, forgets the
tenant filter, and returns another tenant's data. Application-level filtering is
where the mistake happens, and at that layer it is invisible — the query looks
correct.

The obvious mitigation is "just be careful". It does not work. Every new query is
an opportunity, and careful does not scale to a team or a year.

## Decision

Tenant isolation is enforced **twice, independently**:

1. **In the application.** A `tenant_id` filter applied to every query, injected by
   a tenant-aware repository base rather than written by hand per query.
2. **In the database.** Postgres **row-level security** on every tenant-scoped
   table, with a policy keyed to the tenant set per connection or transaction.

Both must fail for a cross-tenant read to succeed.

The specific rules:

- **`tenant_id` is non-null** on every tenant-scoped table, with an index on it.
- **Tenant scope comes from the validated token only** — never a request body, a
  query parameter, or a URL segment. A caller may never choose their tenant. This
  removes the injection point rather than sanitising it.
- **Every tenant-scoped table has RLS enabled and forced**, so the table owner
  cannot bypass it accidentally.
- **A new tenant-scoped table without an RLS policy fails a test.** Enforced, not
  reviewed.
- **Realtime is group-scoped.** Every SignalR send targets a group derived from the
  connection's claims. Hub method parameters are data, never authority.
- **Secrets and audit rows are tenant-scoped like anything else.** An audit record
  is useless if another tenant can read it.
- Cross-tenant access tests run against **real Postgres**, not an in-memory
  substitute, because RLS is a database feature and a fake does not have it.

Tables are prefixed by owning module (`svc_`, `dep_`, `ep_`, `spec_`, `rel_`,
`ten_`, `idn_`, `src_`, `auto_`, `exec_`, `pol_`, `sec_`) so ownership is obvious
at a glance.

## Consequences

### Positive

- **A forgotten filter is not a data breach.** The application filter is a
  convenience; RLS is the guarantee. This is the entire reason for the duplication.
- **One injection point, not N.** The tenant filter comes from a base repository,
  so the common case cannot forget it.
- **Forgetting RLS on a new table is a failing test**, so the gap is caught in CI
  rather than in an incident.
- **Realtime leakage is structurally prevented.** Group scope comes from claims, so
  a client cannot ask to join another tenant's group.
- **Retrofitting is unnecessary**, so it never becomes urgent and never happens in a
  hurry.

### Negative

- **Every query pays the filter.** Performance cost, mostly from missing composite
  indexes. Managed with indexes on `(tenant_id, …)`.
- **RLS interacts badly with connection pooling.** A policy keyed to session state
  must be set per transaction, and a pooled connection carrying the previous
  tenant's setting is a cross-tenant leak. This is the most dangerous footgun in
  the design and needs explicit handling and tests.
- **Support queries get harder.** Cross-tenant operational queries need an explicit
  elevated path, which must itself be audited.
- **Two enforcement layers means two things to configure correctly.** A
  misconfigured `SET LOCAL` could disable RLS for a transaction if written carelessly.
- **Test infrastructure cost.** Integration tests need Testcontainers and real
  Postgres, which is slower than an in-memory fake.

### Neutral

- Tenant IDs are UUIDs from the start. No tenant column is nullable "for now".
- `tenant_id` is on every scoped table rather than being inferred by join. Denormalised
  and redundant, and that is deliberate: RLS cannot follow a join.

## Alternatives considered

**Application-level filtering only.** Rejected: this is the standard answer and it is
insufficient. The forgotten query is invisible in review, and the blast radius is
another tenant's entire dataset.

**RLS only, no application filter.** Rejected: RLS would then be the only line of
defence against a missing predicate, and the queries would be hard to reason about
in development. Two layers are cheap; one is a single point of failure.

**Separate databases or schemas per tenant.** Rejected: connection-pool exhaustion
with many tenants, migrations multiplied by tenant count, and a much larger
operational surface for the self-hosting constraint. Row-level scoping is the
proportionate answer for a single-node install.

**No tenancy; single-tenant per install.** Rejected: it is genuinely simpler and it
is the right answer for many self-hosted tools. It is wrong here because the
Automation API is designed for AI agents and other software, which implies shared
infrastructure, and because a hosted multi-tenant Lazarus is an obvious future.

**Application-enforced tenancy via a global query filter only** (no `tenant_id` in
the schema). Rejected: it cannot be indexed usefully and cannot be enforced by the
database, which defeats the second layer.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §7 — tenant scope from the token
- [`../../AGENTS.md`](../../AGENTS.md) §10 — real Postgres via Testcontainers
- [`../threat-model.md`](../threat-model.md) T3 — cross-tenant data access
- [`0010`](./0010-policy-as-mandatory-chokepoint.md) — the policy chokepoint
