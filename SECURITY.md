# Security Policy

## Reporting a vulnerability

**Report privately. Do not open a public issue, pull request, or discussion.**

Lazarus executes attacker-influenced input by design. The Automation API accepts
a spec as JSON from AI agents and other software, and that spec causes container
creation. A vulnerability in Lazarus is very plausibly a remote code execution
path on the host running it. Treat it accordingly.

Use GitHub's private vulnerability reporting:

> **Security** → **Report a vulnerability** on this repository

If that is unavailable, contact a maintainer directly through the repository
owner rather than posting publicly.

Please include:

- What an attacker can achieve (RCE, cross-tenant read, privilege escalation, …)
- The exact request or spec that triggers it
- Your Lazarus version and deployment configuration
- Whether a real certificate or domain is required
- Any proof-of-concept you have

### What to include

A good report has a clear impact statement and a minimal reproducer. The
engineering team triages faster with those than with a working exploit, and you
are not asked to escalate beyond your own access.

### What happens next

| Stage | Target |
|---|---|
| Acknowledgement | 3 business days |
| Triage and severity | 7 business days |
| Fix and release | Agreed with the reporter |

We will tell you when we believe a report is out of scope and why. We will not
disclose the issue publicly until a fix is released, and we will credit you in
the release notes if you want.

**Do not include live credentials in a report.** Use placeholders and describe the
configuration shape.

## Supported versions

Lazarus is pre-1.0. Fixes land on the latest minor release; there is no
long-term-support branch.

| Version | Supported |
|---|---|
| Latest `0.y` | Yes |
| Older `0.y` | Security fix on request |

## Threat model in brief

The full model is [`docs/threat-model.md`](./docs/threat-model.md). The short
version, so a reporter knows what we already defend:

### Defended by design

- **Untrusted spec input.** Every spec is validated against a JSON Schema, then
  evaluated by `PolicyEvaluator` before anything executes. Policy only ever
  subtracts; it cannot grant a capability.
- **Inexpressible privileges.** The spec schema has **no field** for privileged
  mode, host mounts, host networking, `docker.sock`, added capabilities, or host
  namespaces. They are not "disabled by default" — they cannot be expressed, so
  they cannot be requested.
- **Cross-tenant access.** Tenant scope derives from the validated token, never
  from a body, query parameter, or URL segment. Every tenant-scoped table carries
  `tenant_id` and is additionally protected by Postgres row-level security.
- **Realtime leakage.** Every SignalR send is group-scoped, and every hub method
  derives tenant and actor from the connection's claims, never from its payload.
- **Filesystem writes.** Paths are canonicalised and asserted to be inside the
  intended root before any write, every time.
- **Command execution.** A command is a list of arguments, never a shell string.
- **Secret handling.** Secrets are referenced by name in a spec, never carried by
  value. They are encrypted at rest, redacted from logs and errors, and never
  returned by any API.
- **Container privilege.** Rootless podman, all capabilities dropped,
  `no-new-privileges`, seccomp, cgroup memory/CPU/PID caps, no host namespaces.
- **Images.** Allowlisted registries and base images, digest-pinned. A tag is not
  an identity.
- **Webhooks.** Signature-verified. A webhook body is never trusted.
- **Audit.** Every privilege-affecting action records actor, tenant, target,
  decision, and timestamp.

### Known limitations

Stated plainly, because a hidden limitation is a vulnerability waiting to be
reported:

- **In-memory event dispatch is at-most-once.** A control-plane crash between
  commit and handler completion can lose a domain event, which can leave a
  deployment state machine mid-transition. See `ADR-0003`. The state machine is
  designed to be recoverable by reconciliation; a durable outbox is the fix and
  is not yet implemented.
- **Docker socket exposure.** The control-plane has rootless podman access. A
  control-plane compromise is a host compromise for that user's containers. There
  is no further isolation layer between them.
- **Web terminal is a privileged surface.** Shell access is policy-gated,
  time-limited, and audited, but it is a remote shell by design.
- **No network egress filtering inside a container** beyond what the tenant's
  network policy allows. Policy defaults to deny and allowlists egress, but a
  container that is permitted to reach a host can reach everything that host can.
- **Build-time isolation is weaker than run-time isolation.** Builds execute
  user-supplied commands. They run inside a sandbox, but a build sandbox is not a
  security boundary against a determined attacker — treat build commands as
  untrusted code.

## Hardening an installation

Recommended for any deployment beyond a trusted LAN:

1. **Generate strong secrets.** `openssl rand -base64 48` for
   `BETTER_AUTH_SECRET` and `LAZARUS_MASTER_KEY`. Never reuse, never commit.
2. **Back up `LAZARUS_MASTER_KEY`.** Lose it and every stored secret is
   unrecoverable. There is no recovery path.
3. **Keep the base domain internal** if you do not need public exposure. Public
   endpoints are opt-in per service.
4. **Rotate API keys** on a schedule, and immediately on any suspected leak
   (`docs/runbooks/compromised-api-key.md`).
5. **Keep podman rootless** and the socket accessible only to the control-plane.
6. **Pin images by digest** in production, and keep the base-image allowlist
   narrow.
7. **Watch the audit log.** `docs/runbooks/policy-denials.md` explains what
   repeated denials mean.
8. **Restrict the control-plane API** to the edge proxy where possible. It
   authenticates every request, but it does not need to be world-reachable.

## Out of scope

- Running Lazarus as root, or with a privileged podman socket
- Modifying the spec schema to add a privileged field
- Removing or weakening the Policy chokepoint
- Findings that require an already-compromised control-plane
- Denial of service from exceeding documented quotas
- Missing hardening headers on a self-hosted install without a reverse proxy

## Security-related architecture

`AGENTS.md` §4.5 (the Policy rule), §7 (Security Rules), and §10 (Testing) are
binding on contributors. Phase 7 of `TODO.md` builds the chokepoint; Phase 21
hardens the platform. Container-escape tests are `TODO.md` 21.7.