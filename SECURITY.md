# Security Policy

## Reporting a vulnerability

**Report privately. Do not open a public issue, pull request, or discussion.**

Lazarus executes attacker-influenced input by design. A user types arbitrary
commands, an AI agent may type arbitrary commands on a user's behalf, and any
creator can publish documentation that other users' browsers render. A
vulnerability in Lazarus is very plausibly a remote code execution path on the
host running it, or in a reader's browser. Treat it accordingly.

Use GitHub's private vulnerability reporting:

> **Security** → **Report a vulnerability** on this repository

If that is unavailable, contact a maintainer directly through the repository
owner rather than posting publicly.

Please include:

- What an attacker can achieve (RCE, cross-tenant read, privilege escalation, …)
- The exact request, experience, or document that triggers it
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

- **Policy at runtime, for every command.** Commands are free-form, so a user can
  type anything and an AI agent acting for a user can type anything.
  `PolicyEvaluator` adjudicates *every* execution before anything runs, declared
  or not. A declared command gets a narrower evaluation, never a bypass, and
  hiding a command in the UI is a discovery decision rather than a security one.
- **Policy only ever subtracts.** It cannot grant a capability, and it cannot be
  overridden by an experience, a request payload, or an operator flag.
- **Inexpressible privileges.** The schema has **no field** for privileged mode,
  host mounts, host networking, `docker.sock`, added capabilities, or host
  namespaces. They are not "disabled by default" — they cannot be expressed, so
  they cannot be requested.
- **No shell, anywhere.** A command is a list of arguments and a result is
  structured events. No PTY, no TTY, no byte stream, and no `sh -c` in the
  execution path ([`ADR-0013`](./docs/adr/0013-discrete-executions-no-pty.md)).
- **Sessions are never published.** A session's environment has no ingress route
  and no long-lived publicly reachable service
  ([`ADR-0012`](./docs/adr/0012-sessions-are-not-published.md)). The public attack
  surface is Lazarus's own UI and API.
- **Untrusted creator content.** Documentation is parsed and validated at publish
  time against an explicit component allow-list. Creator `import`, `export`, and
  expression evaluation are not supported, and there is no path from a document to
  `eval` ([`ADR-0017`](./docs/adr/0017-untrusted-creator-content.md)).
- **Escaped rich output.** An ANSI sequence is a colour and control-character
  filter, never `innerHTML`. A sequence carrying cursor or erase semantics is
  stripped, not emulated.
- **Browser-only history.** The transcript lives in the user's own IndexedDB. The
  server stores a TTL-bound session descriptor and no command text and no output
  ([`ADR-0019`](./docs/adr/0019-browser-first-user-history.md)).
- **Cross-tenant access.** Tenant scope derives from the validated token, never
  from a body, query parameter, or URL segment. Every tenant-scoped table carries
  `tenant_id` and is additionally protected by Postgres row-level security.
- **Realtime leakage.** Every SignalR send is group-scoped, and every hub method
  derives tenant and actor from the connection's claims, never from its payload.
- **Filesystem writes.** Paths are canonicalised and asserted to be inside the
  intended root before any write, every time.
- **Secret handling.** Secrets are referenced by name in an experience, never
  carried by value. They are encrypted at rest, redacted from logs and errors, and
  never returned by any API.
- **Container privilege.** Rootless podman, all capabilities dropped,
  `no-new-privileges`, seccomp, cgroup memory/CPU/PID caps, no host namespaces, no
  host mounts.
- **Images.** Allowlisted registries and base images, digest-pinned. A tag is not
  an identity.
- **Webhooks.** Signature-verified. A webhook body is never trusted.
- **Audit.** Every privilege-affecting action, and every policy denial, records
  actor, tenant, target, decision, reason, and timestamp.

### Known limitations

Stated plainly, because a hidden limitation is a vulnerability waiting to be
reported:

- **Free-form commands mean denials are common.** A user typing something
  reasonable and undeclared will be refused often enough that the denial message
  has to explain itself. This is the intended cost of adjudicating every command
  ([`ADR-0015`](./docs/adr/0015-policy-adjudicates-every-command.md)); the fix is
  an operator allow-list change, never a product bypass.
- **Interactive and TTY programs are unsupported by design.** `vim`, `top`, an
  interactive `psql`, and anything else that needs a terminal will not work, and
  will not be made to work. Commands are discrete executions with structured
  results. This is a product decision, not a defect
  ([`ADR-0013`](./docs/adr/0013-discrete-executions-no-pty.md)).
- **A self-hosted operator's allow-lists are their responsibility.** Image
  registries, egress destinations, and privileged commands that policy refuses are
  all operator-level configuration. We constrain them; we do not curate them for
  you, and a wide allow-list in your own config is your own risk.
- **Browser history is per-device and can vanish.** It is stored in the user's
  IndexedDB, so clearing site data erases it, a second device sees nothing, and
  browser storage eviction can remove it without warning
  ([`ADR-0019`](./docs/adr/0019-browser-first-user-history.md)). The UI does not
  claim durability.
- **Transcripts may contain sensitive output the user did not intend to keep.**
  A transcript records real commands and whatever they printed — paths,
  arguments, tokens pasted into a prompt, the contents of files. We keep it on the
  user's device rather than ours, which removes our copy to breach, but the copy
  in their browser is theirs to clear, lose, or share.
- **In-memory event dispatch is at-most-once.** A control-plane crash between
  commit and handler completion can lose a domain event, which can leave a state
  machine mid-transition. See `ADR-0003`. The state machine is designed to be
  recoverable by reconciliation; the durable outbox is the fix and is not yet
  implemented. Execution lifecycle events go through it when it lands.
- **Control-plane compromise is a host compromise for that user's sessions.** The
  control plane has rootless podman access, and there is no further isolation
  layer between them.
- **No network egress filtering inside a container** beyond what the tenant's
  network policy allows. Policy defaults to deny and allowlists egress, but a
  container that is permitted to reach a host can reach everything that host can.
- **A permitted command can do anything inside its container.** Policy gates
  capability, not intent. Real software runs here, and we do not simulate,
  sample, or prettify its output.

## Hardening an installation

Recommended for any deployment beyond a trusted LAN:

1. **Generate strong secrets.** `openssl rand -base64 48` for
   `BETTER_AUTH_SECRET` and `LAZARUS_MASTER_KEY`. Never reuse, never commit.
2. **Back up `LAZARUS_MASTER_KEY`.** Lose it and every stored secret is
   unrecoverable. There is no recovery path.
3. **Keep the install internal** if you do not need external access. Sessions are
   never published, so there is nothing per-tenant to expose and nothing to route.
4. **Rotate API keys** on a schedule, and immediately on any suspected leak
   (`docs/runbooks/compromised-api-key.md`).
5. **Keep podman rootless** and the socket accessible only to the control-plane.
6. **Pin images by digest** in production, and keep the base-image allow-list
   narrow.
7. **Keep egress allow-lists tight.** Because a user can type any command, the
   egress allow-list is the only thing standing between a permitted `curl` and the
   network you meant to permit.
8. **Watch the audit log.** `docs/runbooks/policy-denials.md` explains what
   repeated denials mean.
9. **Restrict the control-plane API** to the edge proxy where possible. It
   authenticates every request, but it does not need to be world-reachable.

## Out of scope

- Running Lazarus as root, or with a privileged podman socket
- Modifying the schema to add a privileged field
- Removing or weakening the Policy chokepoint
- Interactive or TTY programs not working — that is by design
  ([`ADR-0013`](./docs/adr/0013-discrete-executions-no-pty.md))
- A user running a command that does something unwise inside their own container
- Findings that require an already-compromised control-plane
- Denial of service from exceeding documented quotas
- Missing hardening headers on a self-hosted install without a reverse proxy

## Security-related architecture

`AGENTS.md` §4.5 (the Policy rule), §4.9 (creator content is untrusted), §7
(Security Rules), and §10 (Testing) are binding on contributors. The decisions
behind the defences above are:

- [`ADR-0012`](./docs/adr/0012-sessions-are-not-published.md) — a session is
  never published and has no ingress route
- [`ADR-0013`](./docs/adr/0013-discrete-executions-no-pty.md) — discrete
  executions with structured results, no PTY and no shell
- [`ADR-0015`](./docs/adr/0015-policy-adjudicates-every-command.md) — policy
  adjudicates every command at runtime, declared or not
- [`ADR-0017`](./docs/adr/0017-untrusted-creator-content.md) — creator content
  is validated at publish time against a component allow-list
- [`ADR-0019`](./docs/adr/0019-browser-first-user-history.md) — user history is
  browser-local; the server stores a TTL-bound descriptor only

Phase 11 of `TODO.md` builds the chokepoint; Phase 24 hardens the platform and
owns keeping this file and `docs/threat-model.md` current with shipped behaviour
(24.7).
