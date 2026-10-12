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
| Experience publish API | JSON spec → published experience. Untrusted input that drives everything. |
| Documentation | Untrusted authored content, rendered in every reader's browser |
| Interaction and execution | Free-form commands → a real container. The primary RCE path. |
| Session lifecycle | A temporary environment, its TTL, and its reconnection descriptor |
| Container runtime | The trust boundary around user code |
| Policy | The chokepoint that authorises every operation |
| Dashboard | Authenticated user UI, transcript rendering |
| CLI and agent callers | Local machine, an API key or a token |
| Multi-tenancy | Isolation between tenants on shared infrastructure |
| Secret storage | Encryption at rest, redaction, lifecycle |
| Client storage | Browser-local transcript history |

### Out of scope

- The security of the underlying podman, Postgres, Linux kernel, or base images.
  We constrain them; we do not fix them.
- Denial of service beyond documented quotas.
- Physical access to the host.
- A malicious host operator. Self-hosted means the operator is trusted; a
  compromised host compromises everything on it.
- Interactive programs. Anything that wants a TTY is unsupported by design — see
  §6 and [`ADR-0013`](./adr/0013-discrete-executions-no-pty.md).

## 2. Adversaries

| # | Adversary | Capability | Goal |
|---|---|---|---|
| A1 | Unauthenticated external | Network access to the UI and the API | Read data, obtain a foothold |
| A2 | Authenticated-but-malicious user | Valid credentials for their own tenant; may type any command | Escape the sandbox, read other tenants, exceed quotas |
| A3 | Malicious creator | Can publish any schema-valid experience | Run code in a reader's browser, reach secrets, exfiltrate viewing behaviour |
| A4 | Compromised dependency | Execution inside our process | Credential theft, backdoor |
| A5 | Stolen credential | Possession of a tenant key or a session cookie | Full access as that tenant |
| A6 | Malicious or compromised session | Execution inside a sandbox | Escape, lateral movement, reach other tenants |
| A7 | AI agent acting for a user | Composes and submits commands on a user's behalf | Everything A2 can, with a step the user did not read |

A2 is the primary case: an authenticated tenant who is *trying* to break out.
Authentication is not a mitigation for them, and neither is the fact that a
command was or was not mentioned in the documentation.

A7 is A2 with an excuse attached. The agent composes the command, so the user
has no opportunity to notice, and the temptation is to adjudicate the agent more
laxely because "it was the assistant's idea". Policy adjudicates both identically,
or the gate is not a gate.

A6 is the reason container hardening is treated as load-bearing rather than
defence-in-depth. A3 is why publishing is a boundary and not a form submission.

## 3. Trust boundaries

```
   ┌─ Untrusted ───────────────────────────────────────────────┐
   │  A1 bodies, query strings, webhook payloads. A3 source    │
   │  documents, and the remote origins they reference.        │
   └───────────────────────────┬───────────────────────────────┘
                               │  schema validation + PolicyEvaluator
   ┌─ Semi-trusted ────────────▼───────────────────────────────┐
   │  A2 authenticated user, A5 credential holder, A7 agent    │
   │  trusted with THEIR data; untrusted with everything else  │
   └───────────────────────────┬───────────────────────────────┘
                               │  tenant_id from token only
   ┌─ Control plane ───────────▼───────────────────────────────┐
   │  Trusted. Publish boundary: a document is validated here  │
   │  or it does not exist. Tenant isolation holds or it does  │
   │  not.                                                     │
   └───────────────────────────┬───────────────────────────────┘
                               │  podman, all caps dropped, cgroup limits
   ┌─ Container sandbox ───────▼───────────────────────────────┐
   │  A6. Hostile by assumption. Containment is the boundary.  │
   └───────────────────────────┬───────────────────────────────┘
                               │  a document model, never a program
   ┌─ Browser ─────────────────▼───────────────────────────────┐
   │  No creator code executes. Rich output is escaped.        │
   └───────────────────────────┬───────────────────────────────┘
                               │  never leaves the device
   ┌─ Client storage ──────────▼───────────────────────────────┐
   │  A2's own IndexedDB. Unreadable by any other party.       │
   └───────────────────────────────────────────────────────────┘
```

Four boundaries, all load-bearing:

- The **Policy chokepoint** sits between semi-trusted input and the control plane.
- The **publish boundary** sits between a creator's machine and the platform.
  Documentation is validated before it is ever published, so the content that
  reaches a reader is already a reviewed artefact.
- The **container sandbox** sits between the control plane and user code.
- The **render boundary** sits between the control plane and the browser. At read
  time a document is a validated model, not a program.

Crossing any of them without authorisation is a compromise.

## 4. Threats and mitigations

### T1 — Container escape

*Adversaries A2, A3, A6, A7.* **Impact: host compromise.**

The primary risk. If a session's container reaches the host, every tenant's data
on that host is lost.

Mitigations:

- **The schema cannot express privilege.** No field for privileged mode, host
  mounts, host networking, `docker.sock`, added capabilities, or host namespaces.
  Unexpressible beats disabled — there is no request that asks for them.
- **Rootless podman.** Containers run as an unprivileged user with user
  namespaces. A root-owned daemon is not involved.
- **All capabilities dropped**, `no-new-privileges` set.
- **seccomp** profile denying dangerous syscalls.
- **Read-only root filesystem** where the workload allows it, with a temporary
  writable session layer for everything else.
- **cgroup limits** on memory, CPU, and PIDs, so a fork bomb or a memory
  exhaustion attempt is contained.
- **No host namespaces**, no host mounts.
- **Images allowlisted and digest-pinned.** A tag is not an identity; tag
  mutation cannot introduce new code.
- **No ingress route.** A session is never published, so there is no address to
  reach it from outside and nothing to attack over the network
  ([`ADR-0012`](./adr/0012-sessions-are-not-published.md)).
- **Egress policy-controlled**, deny by default.

Residual risk: user namespaces share a kernel. A kernel vulnerability reachable
from inside the sandbox is a host compromise. We constrain the blast radius; we
do not eliminate it. Containment is exercised by `TODO.md` 12.3 and 14.6.

### T2 — Policy bypass

*Adversaries A2, A3, A7.* **Impact: arbitrary privileged operation.**

The command surface is free-form by design, so this is the threat the whole
architecture is arranged around. A user may type anything, and an AI agent acting
for a user may type anything, with or without the user reading it.

Mitigations:

- **Policy adjudicates every execution, at runtime**
  ([`ADR-0015`](./adr/0015-policy-adjudicates-every-command.md)). Not the
  declared commands — every command, whether an experience documented it or
  nobody did.
- **A declared command gets a narrower evaluation, never a bypass.** Writing
  documentation about a command cannot grant it anything.
- **Hiding a command in the UI is a discovery decision, not a security one.** If
  it must not run, policy denies it.
- Policy is a **chokepoint**, not a check at call sites. Reachable `Runtime` and
  `Execution` code with no policy decision in its path is a build failure, caught
  by an architecture test.
- Policy **only ever subtracts**. No code path, schema field, request payload, or
  operator flag can widen a decision.
- The schema has **no field** for privileged mode, host mounts, host networking,
  `docker.sock`, added capabilities, or host namespaces. A user cannot write a
  request that asks for them.
- **Deny by default.** Unknown image, unlisted base, unbounded resource, unlisted
  registry, unrecognised command shape → deny.
- Every decision is **audited**: actor, tenant, target, decision, reason,
  timestamp. A denial is as auditable as an allow.
- The decision matrix is covered by a table-driven test over every combination,
  because a policy with untested branches is a policy with holes.

Residual risk: policy adjudicates the capability, not the intent. A permitted
command can still be one an agent composed for a reason the user would not have
chosen. That is T6.

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
- The control plane validates a **standard ES256 token against the JWKS
  document**. It does not reach into Better Auth framework internals, call back
  into the auth service per request, or depend on an implementation detail that
  could change underneath it.
- `services/auth` is a **separate process on its own schema**, so a
  control-plane compromise cannot mint tokens.
- Browser users hold a server-side session cookie, not a token. There is no token
  in the browser to steal via XSS.
- Key rotation supported; the JWKS document is the only distribution channel.

### T5 — Path traversal

*Adversaries A2, A3.* **Impact: arbitrary file write on the control-plane host.**

This was an unauthenticated RCE in the previous implementation.

Mitigations:

- **Canonicalise the path, then assert containment in the intended root. Every
  time.** No exceptions, not even for an "internal" path.
- Unpacking a prepared environment or a session layer validates **every entry**
  against the same containment check before writing. Archive members are
  attacker-controlled paths.
- Session layers live under a per-session root inside `LAZARUS_DATA_DIR`, and are
  removed with the session.
- No user input reaches a raw path join.

### T6 — Command injection

*Adversaries A2, A3, A6, A7.* **Impact: arbitrary execution — inside a container
that already exists.**

Reframed by [`ADR-0013`](./adr/0013-discrete-executions-no-pty.md). There is no
shell anywhere in the product, so the classic injection surface does not exist: a
command is a list of arguments, `ProcessStartInfo` with `ArgumentList`, and there
is no `sh -c` to inject into. Interpolated command strings are on the banned
list.

The residual risk is therefore not injection into a string. It is three other
things:

- **A policy bypass** — getting a disallowed capability evaluated as a permitted
  one. That is T2, and it is the only one of the three that is a defect.
- **The command doing what it wants inside an already-restricted container.** The
  user may run `curl`, and a permitted egress path leads wherever the operator
  allow-listed. Policy constrains capability; it cannot make a real program safe
  to point at a real network.
- **An AI agent composing a command for a user** who did not read it. Policy
  evaluates the command, not the intent behind it, and a permitted command can
  still be the wrong command.

Controls for the first are T2. For the second: deny-by-default egress,
allow-listed registries, TTL-bound sessions. For the third: policy adjudicates
the agent exactly as it adjudicates the user, and every decision is audited.

### T7 — Secret disclosure

*Adversaries A1, A2, A3, A5.* **Impact: credential compromise.**

Mitigations:

- Secrets are **referenced by name**, never carried by value in an experience.
- **Creator content never reaches a secret.** Documentation is data validated at
  publish time, so there is no path from an authored document to a credential; an
  allow-listed component receives typed string and number props, not the
  environment.
- Encrypted at rest with `LAZARUS_MASTER_KEY`.
- **Redacted in every log and every error message**, by type, not by
  discipline.
- **Never returned by any API**, including to the owner.
- Secrets are injected per session and never written into an image or a session
  layer.
- Environment and podman arguments are treated as secret-bearing and scrubbed.
- Losing `LAZARUS_MASTER_KEY` makes stored secrets unrecoverable. That is
  intended: it means a database backup alone is not enough.

### T8 — Supply chain

*Adversaries A3, A4.* **Impact: compromised dependency, environment, or
document.**

Mitigations:

- Images **digest-pinned**; registries allowlisted.
- An environment definition can only **narrow** a privilege limit. It cannot
  override one.
- **Documentation is validated at publish time**, so an authored document enters
  the platform as a reviewed artefact rather than as arbitrary content arriving
  at a reader. Publish-time validation is a supply-chain control: it is the moment
  untrusted content becomes trusted content. See T11.
- Dependency lockfiles committed; `pnpm install --frozen-lockfile` in CI.
- `dependabot.yml` for automated updates.
- Webhook **signatures verified**; bodies never trusted.
- CI runs with no production credentials and no network access to production.

Residual risk: a prepared environment is authored content too, and a creator can
publish one whose programs phone home when a user runs them. Digest pinning
fixes the identity, not the intent. The controls are pinning, deny-by-default
egress, no secrets by value, and a TTL.

### T9 — Resource exhaustion and denial of service

*Adversaries A1, A2.* **Impact: platform-wide outage.**

Mitigations:

- **Rate-limited and quota-controlled on every write path**, especially session
  start and command submission.
- Per-tenant concurrency limits for sessions and container operations, enforced
  not hoped for.
- cgroup memory, CPU, and PID caps per container.
- Bounded concurrency on podman calls, with timeouts on every one.
- Execution output streams have **backpressure and an idle timeout**. An
  unbounded channel fed by an unbounded process is an outage waiting to happen.
- Sessions expire on a server-enforced TTL, and their resources are reaped even
  when the user abandons one.

### T10 — Privilege escalation through configuration

*Adversaries A2, A5.* **Impact: policy or isolation bypass.**

The risk here is a well-meant change rather than an exploit.

Mitigations:

- **No operator flag and no request field grants a capability.** Policy only
  subtracts, and a typed option that widens a decision is a schema change in
  disguise. No flag exists whose only effect is to permit what policy denies.
- **Policy is never softened to improve the experience.** Free-form commands make
  denials common, and the tempting fix is to widen a rule so a walkthrough works.
  Denials are made explanatory instead, and widening a rule is a schema change
  with an ADR (`TODO.md` 11.7).
- **The base domain is install-time configuration**, never a hardcoded constant,
  so one tenant's install cannot be redirected through another.
- Configuration is **typed options classes validated at startup**. There are no
  string-keyed lookups where a typo silently disables a control.
- An install in dev mode is refused when it would be publicly reachable.

### T11 — Creator documentation as remote code execution

*Adversary A3.* **Impact: code execution in a reader's browser, on our origin,
with that reader's session cookie in scope.**

MDX is a programming language. A brace expression that calls `fetch` and appends
`document.cookie` is valid MDX, so a document that reaches a browser as a program
is remote code execution with our origin as the target.

Mitigations ([`ADR-0017`](./adr/0017-untrusted-creator-content.md)):

- **Parsed and validated at publish time**, not rendered as-is at read time. A
  document that fails validation is never published.
- **Only components on an explicit allow-list may appear.** An unknown component
  name is a validation error, not a passthrough.
- **Creator `import`, `export`, expressions, `{/* */}` evaluation, and arbitrary
  JSX are not supported.** The feature set is prose, headings, code, and
  allow-listed components with typed props. There is no path from a document to
  `eval`.
- **No remote origin is reachable from a document** without a publish-time
  allow-list check on the exact origin. A creator cannot serve script to our users
  after publication.
- Golden-file tests cover every accepted fixture and every rejected one, so adding
  a component is a visible diff in the allow-list and in the tests.

Residual risk: an allow-listed component with a bug. That is a category we own and
can review, which is the point of the reduction.

### T12 — Rich output rendering injection

*Adversaries A2, A3, A6.* **Impact: script execution or UI spoofing in the
reader's browser.**

Output is attacker-controlled: a program can print anything, and a creator can
document a program that prints anything.

Mitigations ([`ADR-0013`](./adr/0013-discrete-executions-no-pty.md)):

- **Rich output is escaped.** Output is text in a transcript block, not markup.
- An ANSI escape sequence is a **colour and control-character filter**. It is
  never passed to `innerHTML`, and a sequence carrying cursor, erase, or
  selection semantics is **stripped, not emulated**.
- The transcript is **normalised once**, where an `ExecutionEvent` becomes a
  `TranscriptBlock`. Presentation consumes blocks and never parses raw output.
- Nothing is sampled, reformatted, or completed: a chunk carries exactly what the
  program printed.

### T13 — Cross-client divergence of the interaction model

*Adversary A4, plus plain accident.* **Impact: one client applies a decision the
others do not.**

There is more than one client over this interaction surface. Two copies of the
reducer diverge within a release, and each is internally consistent, so the
divergence is invisible. A client that decides locally what policy allowed, or
what a transcript block means, holds an authority nobody audited.

Mitigations ([`ADR-0014`](./adr/0014-framework-free-interaction-core.md)):

- The interaction model is implemented **once**, in `packages/interaction`, as a
  pure framework-free reducer that imports only `packages/contracts`.
- **No client holds policy.** The CLI calls the API and never re-implements
  policy, tenancy, or validation, so there is no second authority to disagree
  with the first.
- The frontend package graph is a declared DAG; a new dependency on the core
  fails the build.
- The same table-driven transition suite runs against every client's binding
  without modification.

### T14 — Design-system drift and inaccessible contrast

*Adversary A4, plus plain accident.* **Impact: unreadable output, and a denial or
a document a user cannot read at all.**

Not a confidentiality threat. It is one because the product's entire payload —
documentation, command output, and policy denials — is visual. A deny message
nobody can read is a control that does not work.

Mitigations ([`ADR-0018`](./adr/0018-semantic-tokens-only.md)):

- **Every colour, spacing, radius, shadow, and motion value is a semantic token**
  from `packages/tokens`, which imports nothing at all.
- Raw Tailwind colour utilities, arbitrary values, colour functions, and inline
  styles carrying visual properties are **build failures** outside that package.
- **Dark mode swaps tokens**; it does not add per-component variants. A component
  that must differ between themes defines a semantic token.
- Tokens are named for role rather than order, so a component cannot branch on a
  surface's index and quietly reintroduce the theme branch.
- **Contrast is checked by test**, and a new token is a review trigger (§7).

### T15 — Transcript disclosure

*Adversaries A1, A2, A4, A5.* **Impact: exposure of the most sensitive data we
handle.**

A transcript is a record of the commands a person ran and everything those
commands printed. It will contain paths, arguments, credentials pasted into a
prompt, and output the user never intended to keep.

Mitigations ([`ADR-0019`](./adr/0019-browser-first-user-history.md)):

- **History lives in the client's IndexedDB**, keyed locally. There is no
  server-side copy to breach, retain, or honour a deletion request for.
- The server stores a **session descriptor only** — id, tenant, expiry,
  reconnection metadata — **TTL-bound, expired by the platform**. It holds no
  command text and no output.
- **History never crosses tenants or users**, and no endpoint returns another
  party's transcript.
- Clearing browser storage is a supported way to clear history, not an incident.
- The UI does not imply durability: history is per-device and the browser may
  evict it without warning.

Residual risk: whatever is in the browser is the user's device to lose, clear, or
share. We keep it off our side; we do not keep it safe once it is there.

## 5. Accepted risks

Stated plainly. These are decisions, not oversights.

| Risk | Why accepted | Mitigation |
|---|---|---|
| In-memory events are at-most-once | Durable outbox not built yet; state machines are reconcilable | Execution lifecycle events go through it (`ADR-0013`, `TODO.md` 8.2); reconciliation worker; documented in `ADR-0003` and `SECURITY.md` |
| Control-plane compromise = that user's sessions compromised | The control plane *is* the orchestrator | No further isolation; rootless podman limits reach |
| Kernel vulnerabilities reachable from a sandbox | Container isolation shares the kernel | Hardened profile, watch vendor advisories |
| Free-form commands make denials common | Adjudicating every command is the point (`ADR-0015`) | Explanatory denials; the fix is an operator allow-list change, never a product bypass |
| A permitted command can do anything inside its container | Real software runs; we do not simulate or prettify it | Deny-by-default egress, allow-listed registries, TTL-bound sessions |
| A published environment can contain a program that phones home | Environments are authored content | Digest pinning fixes identity, not intent; no secrets by value |
| Single-node, no HA | Self-hostable on one machine is a hard requirement | Backups and restore runbooks; HA is a later ADR |
| Egress filtering is host-level | Per-container egress control is platform-specific | Policy allowlists egress by default-deny |

## 6. What we do not defend against

- A malicious host operator.
- A kernel or podman vulnerability. We constrain, we do not patch upstream.
- Physical access to the host.
- Social engineering of the operator into weakening their own install.
- DoS beyond documented quotas.
- Findings requiring an already-compromised control plane.
- **Interactive programs and anything wanting a TTY.** `vim`, `top`, an
  interactive `psql`, and anything else that needs a terminal are unsupported
  **by design**, permanently ([`ADR-0013`](./adr/0013-discrete-executions-no-pty.md)).
  Commands are discrete executions with structured results, so there is no PTY to
  allocate. "That program wants a TTY" is not a vulnerability and not a defect; it
  is the product being a different thing from a terminal emulator.
- **A user running a command that does something unwise inside their own
  container.** Policy gates capability, not intent or competence.
- **An AI agent composing a poor command for a consenting user.** Policy
  evaluates the command. It cannot know what the user meant, and no amount of
  gating turns an agent into something that understands the request.

## 7. Review triggers

This model is re-reviewed when:

- A new module is added (`TODO.md` phases 3–25).
- A trust boundary moves — especially any new path from user input to a process
  spawn, a filesystem write, or a browser render.
- A schema field is added. **Every new schema field is a review trigger**,
  because every new field is potentially an expressible privilege.
- The Policy decision matrix changes.
- **A component is added to the MDX allow-list**, because that list is the
  residual code-execution surface for creator content (T11).
- **A client is added**, because a second implementation of the interaction model
  is a second unadudited authority (T13).
- **A semantic token is added or renamed**, because contrast and role naming are
  checked, not assumed (T14).
- An architecture test is relaxed. That is a security event.
- A security report or an escape is disclosed.

Any change that would make self-hosting harder needs an ADR (`AGENTS.md` §1). Any
change that loosens a security control needs an ADR and an explicit note here.

## 8. Related

- [`AGENTS.md` §4.5](../AGENTS.md) — the Policy rule
- [`AGENTS.md` §4.9](../AGENTS.md) — creator content is untrusted
- [`AGENTS.md` §7](../AGENTS.md) — Security Rules
- [`SECURITY.md`](../SECURITY.md) — private reporting
- [`ADR-0012`](./adr/0012-sessions-are-not-published.md) — sessions are never published
- [`ADR-0013`](./adr/0013-discrete-executions-no-pty.md) — discrete executions, no PTY
- [`ADR-0014`](./adr/0014-framework-free-interaction-core.md) — the interaction model is implemented once
- [`ADR-0015`](./adr/0015-policy-adjudicates-every-command.md) — policy adjudicates every command
- [`ADR-0017`](./adr/0017-untrusted-creator-content.md) — creator content is untrusted
- [`ADR-0018`](./adr/0018-semantic-tokens-only.md) — semantic tokens are the only visual surface
- [`ADR-0019`](./adr/0019-browser-first-user-history.md) — browser-first user history
- [`ADR-0005`](./adr/0005-multitenant-row-level-security.md) — tenant isolation
