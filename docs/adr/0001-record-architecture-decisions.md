# 0001 — Record architecture decisions

**Status:** Accepted
**Date:** 2026-10-02

## Context

Lazarus is a platform where a mistake in one place can become a container escape,
a cross-tenant data leak, or an unrecoverable secret disclosure. The rules that
prevent those mistakes are numerous and specific: policy must be a chokepoint,
module isolation is enforced, the spec schema is authoritative, generated code is
never hand-edited.

Documented conventions decay. A rule that lives only in a README is followed by
whoever happened to read it, which is a subset of people, on a good day. Over
months, the codebase drifts toward whatever the most recent contributor assumed,
and nobody notices because each individual change looked reasonable.

Two things make drift visible and expensive to fix:

1. The rules are load-bearing security properties, not preferences. "We should
   probably validate the path" is different in kind from "we should probably use
   trailing commas".
2. The correct choice is not obvious from the code. A chokepoint and a
   call-site check produce similar-looking call sites. Six months later the
   difference is invisible, and someone "simplifies" the chokepoint.

The previous implementation demonstrates the failure mode: it had a policy concept,
a tenancy concept, and a runtime concept, each implemented twice in two Node
backends, drifting apart, with the weaker copy reachable in production.

## Decision

We record architecture decisions as ADRs in `docs/adr/`, numbered sequentially,
immutable once accepted.

An ADR captures one decision: its context, the decision itself, its positive and
negative consequences, and the alternatives considered with reasons for rejection.

A changed decision produces a **new** ADR that supersedes the old one. Accepted
ADRs are never edited to reflect new information; their status line is updated to
`Superseded by [NNNN]`, which is maintenance rather than a new decision.

An ADR is required when:

- a boundary moves or a module is created
- a new external dependency is introduced
- self-hosting would become harder
- a spec change is breaking
- a security control is loosened, or even questioned
- a third implementation of something that already has two is proposed

The alternatives were rejected as above. We record decisions; we do not record
every choice, and we do not treat documentation as a substitute for tests.

## Consequences

### Positive

- A decision can be revisited on its merits rather than re-litigated from memory.
- Security properties have a written rationale, so a future contributor can tell
  the difference between a load-bearing check and cargo cult.
- Rejected alternatives are preserved, which stops the same proposal being
  re-argued every quarter.
- Boundary moves are visible in review, because an ADR appears in the diff.

### Negative

- ADRs are written after the decision, and there is always a temptation to write
  them as justification rather than record.
- ADRs go stale when superseded and nobody reads the index.
- It is overhead on a project that is mostly not built yet.

### Neutral

- The format is a convention, not a tool. Nothing enforces immutability or
  requires an ADR to exist.
- An ADR is not a design document. It explains one choice; it does not describe
  the system.

## Alternatives considered

**Document rules in `AGENTS.md` only.** Rejected: `AGENTS.md` does hold the
invariants and the banned list, and it remains the authority on how to work. What
it cannot hold is the *rationale* for individual choices. "Policy must be a
chokepoint" is a rule; "we tried call-site checks and they leaked in review" is
knowledge, and only an ADR keeps it.

**Enforce decisions with tests only.** Rejected: tests enforce what someone thought
to test. They cannot record why the alternative was rejected, and a rule with no
recorded rationale is a rule that gets "simplified" away.

**Rely on code review alone.** Rejected: review quality varies with reviewer
attention and reviewer availability. This project has one small team and a large
surface area; that does not scale.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §12 — how to work here
- [`../../AGENTS.md`](../../AGENTS.md) §14 — when to stop and ask
- [`README.md`](./README.md) — index and format