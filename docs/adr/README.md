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
| [0003](./0003-in-memory-domain-events.md) | In-memory domain events | Accepted (execution lifecycle uses the outbox — see 0013) |
| [0004](./0004-better-auth-standalone-with-jwks.md) | Better Auth standalone, JWT via JWKS | Accepted |
| [0005](./0005-multitenant-row-level-security.md) | Multi-tenancy with row-level security | Accepted |
| [0006](./0006-subdomain-wildcard-tls.md) | Subdomain routing with wildcard TLS | Superseded by 0012 |
| [0007](./0007-spec-schema-as-sole-contract.md) | The spec schema is the sole contract | Superseded by 0016 |
| [0008](./0008-greenfield-rewrite.md) | Greenfield rewrite, no legacy salvage | Accepted |
| [0009](./0009-justfile-and-pnpm-workspaces.md) | just and pnpm workspaces for cross-language work | Accepted |
| [0010](./0010-policy-as-mandatory-chokepoint.md) | Policy as a mandatory chokepoint | Superseded by 0015 |
| [0011](./0011-self-hostable-before-scalable.md) | Self-hostable before scalable | Accepted |
| [0012](./0012-sessions-are-not-published.md) | Sessions are not published | Accepted |
| [0013](./0013-discrete-executions-no-pty.md) | Discrete command executions, no PTY | Accepted |
| [0014](./0014-framework-free-interaction-core.md) | The interaction model is a framework-free core | Accepted |
| [0015](./0015-policy-adjudicates-every-command.md) | Policy adjudicates every command at runtime | Accepted |
| [0016](./0016-three-versioned-schemas.md) | Three versioned schemas, one codegen target set | Accepted |
| [0017](./0017-untrusted-creator-content.md) | Creator content is untrusted | Accepted |
| [0018](./0018-semantic-tokens-only.md) | Semantic tokens are the only public visual surface | Accepted |
| [0019](./0019-browser-first-user-history.md) | Browser-first user history | Accepted |

### Product change, 2026-10-04

Lazarus changed from a spec-to-build/deploy container platform to an
interactive documentation and software execution platform. Four records were
touched, and none were edited in place:

| Was | Now | Why |
|---|---|---|
| 0006 subdomain routing | [0012](./0012-sessions-are-not-published.md) | A session is temporary and is not published |
| 0010 policy chokepoint | [0015](./0015-policy-adjudicates-every-command.md) | Free-form commands mean every execution needs a decision |
| 0007 one schema | [0016](./0016-three-versioned-schemas.md) | Experience, interaction, and session version independently |
| 0003 in-memory events | unchanged; see [0013](./0013-discrete-executions-no-pty.md) | Execution lifecycle events must not be lost |

The delivery, edge-routing, and CI surfaces they described have been deleted.
Per ADR 0001 a changed decision is superseded rather than erased, so the
reasoning is still readable; each superseded record opens with a banner
pointing at its replacement.


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