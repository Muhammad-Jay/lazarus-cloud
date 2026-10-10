# 0010 — Policy as a mandatory chokepoint

> **Superseded.** The chokepoint decision stands unchanged. What changed is
> scope: policy now adjudicates *every* free-form command at runtime, not only
> the commands an experience declared. See
> [0015 — Policy adjudicates every command](./0015-policy-adjudicates-every-command.md).

**Status:** Superseded by [0015](./0015-policy-adjudicates-every-command.md)
**Date:** 2026-10-02

## Context

This is the most consequential decision in the platform.

Lazarus accepts a spec as JSON from an AI agent or any other software, and that
spec causes a container to run. That is an untrusted-input-to-code-execution path,
and it is the product. Everything else — the dashboard, the CLI, the CI pipeline —
is a way of producing the same input.

So the central security question is not "is the input valid?" but "**who is allowed
to ask for what?**"

The two available approaches both fail, in different ways:

**Check at call sites.** Every `podman run`, every `exec`, every port allocation
gets a validation call. This fails by omission. Every new code path — a retry, a
new module, a "just this once" debug branch, a legitimate helper — is an
opportunity to forget the check. Review cannot catch every instance, and a forgotten
check in a rarely-executed path is exactly the kind of thing that gets found by
someone using it.

**Make the dangerous operations impossible to reach directly.** Hide the podman
access behind an interface with no public bypass. This is better, but an interface
is a convention: `public` methods on a runtime service are callable by anything in
the process, and "nobody calls this one" is not enforced by the compiler.

There is a third framing that changes the problem. The strongest control is not
filtering what a user *can* ask for — it is ensuring they **cannot express** the
dangerous requests at all. If the spec format has no field for host mounts, then
there is no request to validate, no check to forget, and no filter to bypass.

The previous implementation had none of this: no policy concept that gated
operations, an unauthenticated RCE path, and no tenant isolation.

## Decision

**Every container, image, port, exec, volume, and network operation requires a
`PolicyEvaluator` decision before it executes. Policy is a chokepoint, and the
schema is a second, independent boundary.**

### Policy only ever subtracts

`PolicyEvaluator` can **deny** a capability. It can **never grant** one.

There is no code path, spec field, request payload, or operator flag that widens a
decision. Policy is not a default that a caller can override with a "force" argument
— an override capability would be a bypass with a better name.

### Deny by default

Unknown image, unlisted base image, unbounded resource, unlisted registry → **deny**.
The absence of a rule is a denial. A policy that fails open is a policy with a
default-allow hole.

### The schema has no privileged fields

`packages/spec/lazarus.schema.json` has **no field** for:

- privileged mode
- host mounts or `docker.sock`
- host networking
- added capabilities
- host namespaces (PID, IPC, net, user)

They are not "administrator-only", not "disabled by default", and not "behind a
flag". They are **unexpressible**. A user cannot write a request that asks for them,
which means there is no validation to bypass and no filter to forget. This is the
part of the design that does the real work.

### Enforcement

- **Policy is a chokepoint, not a check sprinkled at call sites.** Runtime and Exec
  code reachable without a `PolicyEvaluator` decision is a **build failure**,
  enforced by an architecture test. This is the mechanism that closes the
  call-site-omission gap.
- **The decision matrix is table-driven and fully tested.** Every combination of
  capability, resource bound, registry, and tenant has an expected decision. A
  policy with untested branches is a policy with holes, and the table is how we know
  the branches are covered.
- **Every privilege-affecting action is audited**: actor, tenant, target, decision,
  timestamp. Audit is not optional and not best-effort.
- **Least privilege at the runtime layer**, so a policy mistake is contained rather
  than catastrophic: rootless podman, all capabilities dropped,
  `no-new-privileges`, seccomp, read-only rootfs where possible, cgroup
  memory/CPU/PID caps, no host namespaces.
- **Images are allowlisted and digest-pinned.** A tag is not an identity.
- **Network egress is policy-controlled**, not "allowed by default".

## Consequences

### Positive

- **Omission is a build failure, not a review finding.** The failure mode of a
  call-site check becomes structurally impossible in Runtime and Exec.
- **A user cannot ask for privilege.** The schema is the strongest control in the
  system precisely because it is a specification rather than a check.
- **"Subtract only" makes the policy auditable.** A decision is a set of denials;
  reading the code tells you everything it can forbid, and nothing about what it
  might permit by accident.
- **Deny-by-default means unknown capabilities are safe.** A new podman feature is
  denied until someone deliberately decides to allow it.
- **Layered defence.** A policy bug is contained by container hardening; a hardening
  bug is contained by policy. Neither is the only line.
- **The decision matrix is reviewable.** A security reviewer reads a table, not a
  call graph.

### Negative

- **Policy is on the hot path of every operation**, and evaluating a decision costs
  more than not checking. Mitigated by caching decisions keyed on the request, and
  by policy being a cheap pure function.
- **Denial requires good error messages.** A denied operation is a support ticket
  unless the response says exactly which capability was refused and why.
  `docs/runbooks/policy-denials.md` exists for this.
- **Genuinely legitimate advanced use cases get refused.** Some users will want GPU
  access, specific ports, or a custom registry. Every such request becomes a policy
  conversation instead of a config line. This is the intended friction.
- **The architecture test must be airtight.** If it can be satisfied by a code path
  that skips the decision, the chokepoint is decorative. It needs its own review.
- **Two boundaries to keep aligned.** The schema and the policy matrix must agree.
  A field in one with no rule in the other is a silent default-deny — correct, but
  confusing to users.

### Neutral

- Policy decisions are recorded in the audit log whether allowed or denied. A
  denial is a normal outcome, not an error.
- Policy is tenant-configurable only by *narrowing* what the tenant may do. The
  tenant's effective capability set is the intersection of the platform policy and
  the tenant's policy, and it can only shrink.
- An operator cannot disable Policy. There is no `POLICY_ENABLED=false`.

## Alternatives considered

**Call-site validation.** Rejected: fails by omission, which is the one failure mode
a security control must not have. Every new path is a chance to forget, and a
forgotten check in an unusual code path is precisely how the previous implementation
became an unauthenticated RCE.

**Validate once at the API boundary, then trust downstream.** Rejected: a request
that passes validation can still reach a privileged operation through a different
route — a retry, a pipeline step, a terminal attach, a reconciliation pass. The
check has to be where the operation is.

**A capability-based system with handle-passing.** The most robust design in
principle. Rejected as premature: it requires threading a capability handle through
every signature including EF queries and background jobs, which is a large tax on a
codebase that does not exist yet. Revisit if the chokepoint leaks in practice.

**Let users express privilege and gate it with a role.** Rejected outright: it makes
the dangerous request expressible, which is exactly what we are avoiding. A user with
the right role can then ask for host mounts, and the request travels through
validation, logging, and auditing as ordinary data.

**Schema restrictions alone, no PolicyEvaluator.** Rejected: the schema covers the
fields we anticipated. It cannot express "this image is fine but that tenant is over
quota", or a registry allowlist, or resource bounds that depend on the plan. It is
the strongest *static* boundary; policy is the *dynamic* one. Both are needed.

**An external policy engine (OPA, or a sidecar).** Rejected: it makes a mandatory
external dependency for a security decision, which breaks self-hosting
(`ADR-0011`), and it introduces a network hop into the path that must never fail
open. Policy as a pure library function in-process cannot be bypassed by a network
problem.

**Policy in the Runtime module only.** Rejected: Exec, Endpoints, and Automation all
need decisions, and folding it into Runtime means every other module depends on
Runtime — the coupling `ADR-0002` exists to prevent. It is its own module.

**Make Policy optional for the operator.** Rejected: any operator who can disable
it can be socially engineered into disabling it, and it is the only control between
a hostile spec and a privileged operation.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §4.5 — the Policy rule
- [`../../AGENTS.md`](../../AGENTS.md) §7 — security rules
- [`../threat-model.md`](../threat-model.md) T1, T2 — escape and bypass
- [`../../SECURITY.md`](../../SECURITY.md) — threat model summary
- [`0007`](./0007-spec-schema-as-sole-contract.md) — the schema as security boundary
- [`0002`](./0002-dotnet-modular-monolith.md) — module isolation, why Policy is separate
- [`../runbooks/policy-denials.md`](../runbooks/README.md) — operational response to denials
