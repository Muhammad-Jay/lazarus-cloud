# 0015 — Policy adjudicates every command at runtime

**Status:** Accepted
**Date:** 2026-10-04

**Supersedes:** [0010](./0010-policy-as-mandatory-chokepoint.md)

## Context

ADR 0010 decided that no container, image, exec, or network
operation executes without a `PolicyEvaluator` decision, that policy is a
chokepoint rather than a check at call sites, and that it can only subtract. That
decision remains correct and is kept here verbatim in spirit: policy is a
chokepoint, it only ever subtracts, and it cannot be overridden by a spec, a
payload, or an operator flag.

What changed is **what has to be adjudicated**. ADR 0010 was written for a
spec-driven product: the creator declared what would run, so the declared set was
the natural evaluation set. A command the spec did not declare did not exist.

The new product is interactive documentation and software execution. An experience
declares commands it *documents*, and a user composes *any* command they like —
`ls -la /tmp`, `git status`, a typo, `curl …`. An AI agent acting for a user may
type anything as well. So the declared command set is a **discovery affordance**,
not an authorisation set.

The temptation, and it is a strong one, is to validate at submit time against the
declared commands and let anything else through, because that is one check in one
place and it is fast. It is also the exact hole the product is built around.

## Decision

**`PolicyEvaluator` adjudicates every execution, at runtime, before any container,
exec, filesystem, or network operation proceeds. This holds for commands the
experience declared and for commands nobody declared.**

- A command the experience declared receives a **narrower** evaluation — it may be
  permitted by fewer rules, not more. Declared is never a bypass.
- **Hiding a command in the UI is a discovery decision, not a security decision.**
  If a command must not run, policy denies it. If a command is merely not
  documented, it is absent from suggestions and nothing more.
- Policy **only ever subtracts**. There is no code path, request field, or
  operator flag that grants a capability. The session schema has **no field** for
  privileged mode, host mounts, host networking, `docker.sock`, added
  capabilities, or host namespaces — they are not expressible, so no request can
  ask for them.
- **Deny by default.** Unknown image, unlisted base, unbounded resource, unlisted
  registry, unrecognised command shape → deny.
- Policy is a **chokepoint**: reachable `Runtime` and `Execution` code with no
  policy decision in the path is a build failure, caught by an architecture test.
  Do not look for a way around the test.
- The decision is **audited** every time: actor, tenant, target, decision,
  reason, timestamp. A denial is as auditable as an allow.

## Consequences

### Positive

- The untrusted-input-to-RCE path has exactly one gate, and it is on every path.
- Adding a new command to an experience's documentation cannot accidentally grant
  a capability.
- The UI can hide freely for usability without any security consequence, which
  frees the design from carrying a burden it was never safe to carry.
- Architecture tests can prove the property structurally rather than by review.

### Negative

- Every execution pays an evaluation. Mitigated by evaluating against a compiled
  decision set rather than re-parsing configuration per request, but the cost is
  real and latency is a metric.
- Free-form commands mean the deny path is **common**, not exceptional. A user
  typing something reasonable and undeclared will be refused often enough that
  the denial message must be explanatory. This is a UX cost we are choosing to
  absorb rather than weaken the gate.
- Deny-by-default on unlisted registries means a user cannot curl an arbitrary
  host. That will frustrate people who want an unrestricted sandbox. The answer
  is an operator-level allow-list change, not a product bypass.

### Neutral

- Adjudication happens before execution, not during. There is no runtime
  interruption mid-command if the policy set changes.

## Alternatives considered

**Evaluate only declared commands; let undeclared ones through.** Rejected: the
user is the adversary, and they can type anything. This is the hole.

**Evaluate in the client and reject before submitting.** Rejected: the client is
not trusted, the check is trivially bypassed, and it would give the UI authority
it must not have. It is acceptable *in addition to* the server decision purely to
avoid a pointless round trip.

**Ask the user to confirm each undeclared command.** Rejected: a confirmation
prompt is a speed bump on a path an attacker does not have to click.

**Run the container first and enforce policy inside it.** Rejected: the container
is the thing policy exists to constrain. Policy before, not inside.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §4.5 — the policy rule
- [`../../AGENTS.md`](../../AGENTS.md) §7 — security rules
- [`0010-policy-as-mandatory-chokepoint.md`](./0010-policy-as-mandatory-chokepoint.md)
- [`0013-discrete-executions-no-pty.md`](./0013-discrete-executions-no-pty.md)
- [`../threat-model.md`](../threat-model.md)
