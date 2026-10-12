# 0012 — Sessions are not published

**Status:** Accepted
**Date:** 2026-10-04

## Context

[ADR 0006](./0006-subdomain-wildcard-tls.md) decided that every exposed port got
a real subdomain with wildcard ACME, routed by an edge proxy (Caddy). That
decision was correct for the product it was written for: a spec declared a
long-running service, and users needed to reach it at a stable, TLS-protected
address.

The product is now interactive documentation and software execution
([`../../AGENTS.md`](../../AGENTS.md) §1). A user opens an experience, runs
commands to understand something, and reads the output. The unit of work is a
**session**, not a deployment:

- A session is short-lived and expires. There is no stable address to hand
  someone.
- Nothing in the session is intended to be reached over HTTP. The surface a user
  interacts with is the transcript.
- Publishing a session's ports would turn "read the docs and try it" into "run an
  arbitrary attacker's workload on a public hostname", for a feature nobody asked
  for.
- Wildcard ACME requires an owned domain. Self-hosting without one already
  degrades to a self-signed CA. Keeping edge routing would have meant every
  self-hosted install carried Caddy configuration for a feature it cannot use.

The delivery and edge-routing surfaces are being deleted, not deprecated.

## Decision

**A session is never published. There is no subdomain routing, no
subdomain-per-deployment, and no long-lived publicly reachable service.**

- The edge terminates TLS for Lazarus's own UI and API, and nothing else.
- A session's environment has **no ingress route**. Network egress from a
  session is policy-controlled and deny-by-default.
- If a future feature genuinely needs an inbound path — a preview, a callback, a
  webhook target — it requires its own ADR that re-opens this decision, states
  the tenancy and lifetime model, and does not revive wildcard routing as a
  default.

This supersedes ADR 0006.

## Consequences

### Positive

- The public attack surface is Lazarus's own UI and API. A session cannot become
  a public origin by configuration.
- Self-hosting gets simpler: no Caddy routing config, no wildcard certificate, no
  `*.domain` DNS requirement.
- Sessions can be destroyed confidently, because nothing external depends on
  their address.
- Egress-only policy is easier to reason about than ingress-plus-egress.

### Negative

- Experiences cannot offer a live hosted demo without a new decision.
- A workflow that depended on a stable URL breaks. This is intended.
- Wildcard ACME is no longer motivated, so TLS for self-hosting relies on the
  self-signed CA path already committed to in ADR 0011.

### Neutral

- TLS termination itself is unaffected. The edge still serves HTTPS; it just has
  no routing table of user workloads.
- Session state was always temporary. Nothing about lifetime changed.

## Alternatives considered

**Keep edge routing for future previews.** Rejected: it is speculative
infrastructure for a feature that does not exist, and it keeps a class of
misconfiguration ("did I expose that session?") permanently reachable. The
honest state is no ingress, with a documented way to add it deliberately.

**Publish sessions read-only on a single shared host, no per-session subdomain.**
Rejected: still creates public origins for user-controlled workloads, and buys
nothing now.

**Delete ADR 0006 outright.** Rejected: ADR 0001 requires supersession rather
than erasure, so the reasoning that led to wildcard routing — reasonable under
the old product — stays readable.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §1 — anti-goals: public exposure of user
  containers
- [`0013-discrete-executions-no-pty.md`](./0013-discrete-executions-no-pty.md)
- [`../threat-model.md`](../threat-model.md) — session isolation
