# Architecture Decision Records

An ADR captures a decision that was made, the context that produced it, and what
it costs. Its value is in the *why*: a month later, nobody remembers why the
control plane is a monolith instead of a set of services, and without a record the
next person either rewrites it or preserves it for the wrong reason.

## Format

```markdown
# NNNN — Title

**Status:** Proposed | Accepted | Superseded by [NNNN]
**Date:** YYYY-MM-DD

## Context
The forces. What was true when the decision was made.

## Decision
What was decided, stated so it can be obeyed.

## Consequences
### Positive
### Negative
### Neutral

## Alternatives considered
Each with why it was rejected. This is the part that saves time later.

## References
```

## Rules

- **Immutable once accepted.** A changed decision is a new ADR that supersedes the
  old one. Editing history destroys the only record of why something exists.
- **Status updates are allowed.** Marking a decision `Superseded` when it is
  superseded is maintenance, not a new decision.
- **One decision per record.** Two decisions in one ADR means neither is
  reviewable.
- **An ADR is not a design doc.** It does not describe the system; it explains one
  choice. The system is described in [`../architecture.md`](../architecture.md).
- **Write the alternative that hurt most.** If a rejected option is obviously
  right to you, the reasoning is not obvious to the next reader.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](./0002-dotnet-modular-monolith.md) | .NET 10 modular monolith for the control plane | Accepted |
| [0003](./0003-in-memory-domain-events.md) | In-memory domain events | Accepted |
| [0004](./0004-better-auth-standalone-with-jwks.md) | Better Auth standalone, JWT via JWKS | Accepted |
| [0005](./0005-multitenant-row-level-security.md) | Multi-tenancy with row-level security | Accepted |
| [0006](./0006-subdomain-wildcard-tls.md) | Subdomain routing with wildcard TLS | Accepted |
| [0007](./0007-spec-schema-as-sole-contract.md) | The spec schema is the sole contract | Accepted |
| [0008](./0008-greenfield-rewrite.md) | Greenfield rewrite, no legacy salvage | Accepted |
| [0009](./0009-justfile-and-pnpm-workspaces.md) | just and pnpm workspaces for cross-language work | Accepted |
| [0010](./0010-policy-as-mandatory-chokepoint.md) | Policy as a mandatory chokepoint | Accepted |
| [0011](./0011-self-hostable-before-scalable.md) | Self-hostable before scalable | Accepted |

## When an ADR is required

- A boundary moves, or a module is created.
- A new external dependency is introduced.
- Self-hosting gets harder.
- A spec change is breaking.
- A security control is loosened, or even questioned.
- A third implementation of something that already has two is proposed.

That last one is the common trigger. Write the ADR *before* writing the third
implementation, because the ADR is usually what convinces you to delete one of
them (`AGENTS.md` §14).

Disagreement with `AGENTS.md` is expected and healthy. Raise it as an ADR
proposal rather than working around it silently.