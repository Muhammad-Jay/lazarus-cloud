# Threat model

Scope, adversaries, trust boundaries, and what we deliberately do not defend.
Reviewed whenever a module is added or a trust boundary moves.

This document exists so that security engineering is a design input rather than a
late audit. Every claim here should correspond to code and a test. Where it does
not yet, the gap is tracked in [`TODO.md`](../TODO.md) rather than smoothed over.

## 1. Scope

### In scope

| Surface | Risk |
|---|---|
| Automation API | JSON spec → container creation. The primary RCE path. |
| Dashboard | Authenticated user UI, session handling |
| Web terminal | Remote shell in a container |
| GitHub App | Webhooks, source fetch, credentials |
| CLI | Local machine, uses an API key |
| Spec parsing | Untrusted input, drives everything |
| Container runtime | The trust boundary around user code |
| Edge routing | Subdomain → port mapping, TLS termination |
| Multi-tenancy | Isolation between tenants on shared infrastructure |
| Secret storage | Encryption at rest, redaction, lifecycle |
| Policy | The chokepoint that authorises operations |

### Out of scope

- The security of the underlying podman, Postgres, Linux kernel, or base images.
  We constrain them; we do not fix them.
- Denial of service beyond documented quotas.
- Physical access to the host.
- A malicious host operator. Self-hosted means the operator is trusted; a
  compromised host compromises everything on it.

## 2. Adversaries

| # | Adversary | Capability | Goal |
|---|---|---|---|
| A1 | Unauthenticated external | Network access to the edge | Read data, obtain a foothold |
| A2 | Authenticated tenant | Valid API key for their own tenant | Escape the sandbox, read other tenants, exceed quotas |
| A3 | Hostile spec author | Can submit any schema-valid spec | Achieve code execution outside the container |
| A4 | Compromised dependency | Execution inside our process | Credential theft, backdoor |
| A5 | Stolen API key | Possession of a tenant key | Full access as that tenant |
| A6 | Malicious or compromised container | Execution inside a sandbox | Escape, lateral movement, reach other tenants |
| A7 | CI/CD attacker | Can push to a connected repo | Trigger a build, exfiltrate secrets, supply a malicious image |

A2 and A3 are the same person in practice, and they are the interesting case: an
authenticated tenant who is *trying* to break out. Authentication is not a
mitigation for them.

A6 is the reason container hardening is treated as load-bearing rather than
defence-in-depth.

## 3. Trust boundaries

```
   ┌─ Untrusted ──────────────────────────────────────────────┐
   │  A1, A3 input: spec, JSON, webhook bodies, form fields   │
   └───────────────────────────┬───────────────────────────────┘
                               │  schema validation + PolicyEvaluator
   ┌─ Semi-trusted ────────────▼───────────────────────────────┐
   │  A2 authenticated tenant, A5 key holder                   │
   │  trusted with THEIR data; untrusted with everything else  │
   └───────────────────────────┬───────────────────────────────┘
                               │  tenant_id from token only
   ┌─ Control plane ───────────▼───────────────────────────────┐
   │  Trusted. Tenant isolation holds or it does not.          │
   └───────────────────────────┬───────────────────────────────┘
                               │  podman, all caps dropped, cgroup limits
   ┌─ Container sandbox ───────▼───────────────────────────────┐
   │  A6. Hostile by assumption. Containment is the boundary. │
   └───────────────────────────────────────────────────────────┘
```

The **Policy chokepoint** sits between semi-trusted input and the control plane.
The **container sandbox** sits between the control plane and user code. Both are
security boundaries in the strict sense: crossing them without authorisation is a
compromise.

## 4. Threats and mitigations

### T1 — Container escape

*Adversaries A2, A3, A6.* **Impact: host compromise.**

The primary risk. If a user container reaches the host, every tenant's data is
lost.

Mitigations:

- **The spec cannot express privilege.** No field for privileged mode, host
  mounts, host networking, `docker.sock`, added capabilities, or host namespaces.
  Unexpressible beats disabled — there is no request that asks for them.
- **Rootless podman.** Containers run as an unprivileged user with user
  namespaces. A root-owned daemon is not involved.
- **All capabilities dropped**, `no-new-privileges` set.
- **seccomp** profile denying dangerous syscalls.
- **Read-only root filesystem** where the workload allows it.
- **cgroup limits** on memory, CPU, and PIDs, so a fork bomb or a memory
  exhaustion attempt is contained.
- **No host namespaces**, no host mounts.
- **Images allowlisted and digest-pinned.** A tag is not an identity; tag
  mutation cannot introduce new code.
- **Egress policy-controlled**, deny by default.

Residual risk: user namespaces share a kernel. A kernel vulnerability reachable
from inside the sandbox is a host compromise. We constrain the blast radius; we
do not eliminate it. Escape testing is `TODO.md` 21.7.

### T2 — Policy bypass

*Adversaries A2, A3.* **Impact: arbitrary privileged operation.**

Mitigations:

- Policy is a **chokepoint**, not a check at call sites. Runtime and Exec code
  reachable without a `PolicyEvaluator` decision is a build failure, caught by an
  architecture test.
- Policy **only subtracts**. No code path, spec field, request payload, or
  operator flag can widen a decision.
- Deny by default. Unknown image, unlisted base, unbounded resource, unlisted
  registry → deny.
- The decision matrix is covered by a table-driven test over every combination,
  because a policy with untested branches is a policy with holes.

### T3 — Cross-tenant data access

*Adversaries A2, A5.* **Impact: breach of another tenant's data.**

Mitigations:

- Tenant scope comes from the **validated token only**. Never a body, a query
  parameter, or a URL segment. A caller cannot choose their tenant, so there is no
  injection point to choose one.
- Every tenant-scoped table carries `tenant_id`.
- **Postgres row-level security** as independent enforcement. App filtering and
  RLS must both fail for a read to succeed — defence that does not share a bug.
- Every realtime send is group-scoped; every hub method derives tenant and actor
  from the connection's claims, never from its payload.
- Integration tests exercise cross-tenant reads against real Postgres.

### T4 — Authentication forgery

*Adversary A1.* **Impact: unauthenticated access.**

Mitigations:

- ES256 asymmetric tokens, so verification needs only a public key.
- JWKS published by `services/auth`; consumers validate locally. A network
  partition in auth does not become an authentication outage.
- `services/auth` is a **separate process on its own schema**, so a
  control-plane compromise cannot mint tokens.
- Browser users hold a server-side session cookie, not a token. There is no token
  in the browser to steal via XSS.
- Key rotation supported; the JWKS document is the only distribution channel.

### T5 — Path traversal

*Adversary A2, A3.* **Impact: arbitrary file write on the control-plane host.**

This was an unauthenticated RCE in the previous implementation.

Mitigations:

- **Canonicalise the path, then assert containment in the intended root. Every
  time.** No exceptions, not even for an "internal" path.
- `tar`/archive extraction validates every entry against the same containment
  check before writing. Archive members are attacker-controlled paths.
- Source checkouts are confined to a per-repository root under `LAZARUS_DATA_DIR`.
- No user input reaches a raw path join.

### T6 — Command injection

*Adversaries A3, A6.* **Impact: arbitrary execution as the control-plane user.**

Mitigations:

- **No shell, anywhere.** `ProcessStartInfo` with `ArgumentList`; a command is a
  list of arguments, never a string.
- Interpolated shell command strings are on the banned list.
- Every external call has a timeout. A hung podman call is a resource leak, not a
  strategy.

### T7 — Secret disclosure

*Adversaries A1, A2, A5, A7.* **Impact: credential compromise.**

Mitigations:

- Secrets are **referenced by name**, never carried by value in a spec.
- Encrypted at rest with `LAZARUS_MASTER_KEY`.
- **Redacted in every log and every error message**, by type, not by
  discipline.
- **Never returned by any API**, including to the owner.
- Secrets injected per-deployment and never written to the image.
- Environment and podman arguments are treated as secret-bearing and scrubbed.
- Losing `LAZARUS_MASTER_KEY` makes stored secrets unrecoverable. That is
  intended: it means a database backup alone is not enough.

### T8 — Supply chain

*Adversary A4.* **Impact: compromised build or dependency.**

Mitigations:

- Images **digest-pinned**; registries allowlisted.
- Dependency lockfiles committed; `pnpm install --frozen-lockfile` in CI.
- `dependabot.yml` for automated updates.
- Webhook **signatures verified**; bodies never trusted.
- GitHub App installed per-repository with minimal scope.
- CI runs with no production credentials and no network access to production.

Residual risk: a build executes user-supplied commands. A build sandbox is not a
security boundary against a determined attacker. Treat build commands as
untrusted code.

### T9 — Resource exhaustion and denial of service

*Adversaries A1, A2.* **Impact: platform-wide outage.**

Mitigations:

- **Rate-limited and quota-controlled on every write path**, especially the
  Automation API.
- Per-tenant concurrency limits for container operations, enforced not hoped for.
- cgroup memory, CPU, and PID caps per container.
- Bounded concurrency on podman calls, with timeouts on every one.
- Log and terminal streams have **backpressure and an idle timeout**. An
  unbounded channel fed by an unbounded process is an outage waiting for a busy
  deploy.

### T10 — Privilege escalation through configuration

*Adversary A2.* **Impact: policy or isolation bypass.**

Mitigations:

- **The base domain is install-time configuration**, never a hardcoded constant,
  so one tenant's install cannot be redirected through another.
- Configuration is **typed options classes validated at startup**. There are no
  string-keyed lookups where a typo silently disables a control.
- An install in dev mode is refused when it would be publicly reachable.

## 5. Accepted risks

Stated plainly. These are decisions, not oversights.

| Risk | Why accepted | Mitigation |
|---|---|---|
| In-memory events are at-most-once | Outbox not built yet; state machines are reconcilable | Reconciliation worker; documented in `ADR-0003` and `SECURITY.md` |
| Control-plane compromise = that user's containers compromised | The control plane *is* the container orchestrator | No further isolation; rootless podman limits reach |
| Kernel vulnerabilities reachable from a sandbox | Container isolation shares the kernel | Hardened profile, watch vendor advisories |
| Build commands run untrusted code | Builds are the product | Sandboxed, rate-limited, no host access, no secrets in the build env |
| Web terminal is a remote shell | It is a feature | Policy-gated, TTL, resource-capped, audited |
| Single-node, no HA | Self-hostable on one machine is a hard requirement | Backups and restore runbooks; HA is a later ADR |
| Egress filtering is host-level | Per-container egress control is platform-specific | Policy allowlists egress by default-deny |

## 6. What we do not defend against

- A malicious host operator.
- A kernel or podman vulnerability. We constrain, we do not patch upstream.
- Physical access to the host.
- Social engineering of the operator into weakening their own install.
- DoS beyond documented quotas.
- Findings requiring an already-compromised control plane.

## 7. Review triggers

This model is re-reviewed when:

- A new module is added (`TODO.md` phases 3–14).
- A trust boundary moves — especially any new path from user input to a process
  spawn or a filesystem write.
- A spec field is added. **Every new spec field is a review trigger**, because
  every new field is potentially an expressible privilege.
- The Policy decision matrix changes.
- An architecture test is relaxed. That is a security event.
- A security report or an escape is disclosed.

Any change that would make self-hosting harder needs an ADR
(`AGENTS.md` §1). Any change that loosens a security control needs an ADR and an
explicit note here.

## 8. Related

- [`AGENTS.md` §4.5](../AGENTS.md) — the Policy rule
- [`AGENTS.md` §7](../AGENTS.md) — Security Rules
- [`SECURITY.md`](../SECURITY.md) — private reporting
- [`ADR-0010`](./adr/0010-policy-as-mandatory-chokepoint.md) — Policy as chokepoint
- [`ADR-0005`](./adr/0005-multitenant-row-level-security.md) — Tenant isolation