# Architecture

How Lazarus is put together, and why. For the rules that govern changes, read
[`AGENTS.md`](../AGENTS.md). For the decision behind any specific choice, read the
ADR cited in the margin. For a module's own boundaries, read
[`docs/modules/`](./modules/).

## Context

Lazarus turns a declaration — an experience, a form submission, a JSON payload
from an AI agent — into something a user reads and then runs real commands
against. That is an untrusted-input-to-code-execution path, and it is the
product. The architecture exists to make that path survivable.

Four facts shape everything:

1. **The input is hostile.** An experience arrives from a creator, and a command
   arrives from a user or from an AI agent acting for one. All are hostile, even
   when authenticated.
2. **The consequence is code execution.** A container that escapes takes the
   host. There is no partial failure.
3. **The output is real.** A user is reading what a program actually printed. We
   never fabricate, sample, or prettify it.
4. **The operator is one person.** A hosted control plane may exist one day. The
   product may never require one.

## Components

```
                     ┌──────────────┐
   browser ─────────►│              │
   Go CLI ──────────►│  apps/web    │  Next.js 16, composition only
   AI agent ────────►│              │
   (JSON + key)      └──────┬───────┘
                            │ server-side session cookie
                            ▼
                     ┌──────────────┐        ┌──────────────────┐
                     │  services/   │        │  apps/cli        │
                     │  auth        │◄──────►│  Go CLI          │
                     │  Better Auth │  JWKS  └──────────────────┘
                     └──────┬───────┘
                            │ ES256 tokens, local verification
                            ▼
              ┌─────────────────────────────────┐
              │  apps/control-plane             │
              │  .NET 10, modular monolith     │
              │  ┌───────────────────────────┐  │
              │  │  Api                      │  │  REST + SignalR
              │  │  ├─ Infrastructure        │  │  EF, outbox, tenancy
              │  │  ├─ Modules/*             │  │  10 modules
              │  │  ├─ Application  ◄────────┼──┼── DTOs across modules
              │  │  └─ Domain        ◄────────┼──┼── shared primitives
              │  └───────────────────────────┘  │
              └───────────────┬─────────────────┘
                              │ every container, exec, and network
                              │ operation behind PolicyEvaluator
                              ▼
              ┌─────────────────────────────────┐
              │  rootless podman                │
              │  exec · stream · cancel         │
              │  no ingress route, ever         │
              └─────────────────────────────────┘

  apps/desktop (Tauri) ──► packages/interaction ◄── apps/web
```

### apps/web — Next.js 16

Composition only. Routes, layouts, page composition, provider wiring. It contains
no business logic, no data access, no state machines, no validation, and no
hand-written API clients. Everything it needs is a function or a type in
`packages/`.

The interesting dependency is `packages/interaction`, which holds the entire
interaction model as a pure reducer. `apps/web` binds it to React with a thin
`useReducer` plus transport and storage wiring — wiring that contains no product
logic. See [`ADR-0014`](./adr/0014-framework-free-interaction-core.md).

### packages/interaction — the interaction model

The only place the interaction model exists. It imports `@lazarus/contracts` and
**nothing else**: no React, no DOM, no transport, no styling, no timers.

It owns the state shape, the pure reducer, transcript normalisation, execution
event application, suggestion ranking, draft-conflict resolution, and block
ordering. This is what makes `apps/desktop` a new client rather than a
rewrite — see [`ADR-0014`](./adr/0014-framework-free-interaction-core.md) and
`AGENTS.md` §4.8.

### apps/control-plane — .NET 10

The engine. A modular monolith, because the modules share one process, one
database, and one transaction boundary, and splitting them across processes would
buy latency and operational cost in exchange for a boundary we can enforce in CI.

The layer graph (`AGENTS.md` §4.1) points inward:

```
Api  →  Application  →  Domain
                        ↑
              Infrastructure
```

`Lazarus.Domain` references nothing — no project, no framework. It holds a small
set of primitives and no business aggregates. That is the whole point: the shared
kernel is small enough that promoting something into it means two modules need
it, which usually means it is two things.

Ten modules: `Experiences`, `Documentation`, `Environments`, `Sessions`,
`Execution`, `Policy`, `Runtime`, `Tenancy`, `Identity`, `Audit`.

### services/auth — Better Auth

The trust root, and deliberately not inside the control plane. It is a separate
service on its own Postgres schema, so that a control-plane compromise does not
grant the attacker the ability to mint tokens.

It issues asymmetric ES256 JWTs and publishes a JWKS document. Consumers verify
locally. No request to Lazarus ever needs to reach the auth service to be
authenticated, which means auth can be temporarily unavailable without taking the
platform down.

The control plane validates the **standard ES256 token against the JWKS
document**. It is a JWKS consumer, not a Better Auth client, and does not
reference Better Auth framework types or internals.

A user of `apps/web` gets a server-side session cookie instead. Same identity,
different transport. No browser ever holds a token.

### apps/cli — Go

A static binary. Users' automation runs in their shell, so it must be
dependency-free, start instantly, and work without a Node runtime on the machine.

It calls the API. It never re-implements policy, tenancy, or validation.

### apps/desktop — Tauri

A shell. Window lifecycle, IPC, and a runtime port that executes locally. It holds
no interaction logic and consumes `packages/interaction` exactly as `apps/web`
does. If it needs a change to the reducer, `packages/interaction` was wrong.

### Edge — TLS termination only

Automatic certificates for Lazarus's own UI and API. Wildcard when the operator
owns a domain, self-signed when they do not.

There is **no routing table for user workloads**. A session is never published,
gets no subdomain, and has no ingress route — see
[`ADR-0012`](./adr/0012-sessions-are-not-published.md), which supersedes the
earlier subdomain-routing decision.

## Cross-cutting concerns

### Tenancy

Tenant identity comes from the validated token and nowhere else — never a body, a
query parameter, or a URL segment. A caller may never choose their tenant.

Every tenant-scoped table carries `tenant_id`, and Postgres row-level security
provides a second, independent enforcement. Application filtering and RLS must
both fail for a cross-tenant read to succeed. See
[`ADR-0005`](./adr/0005-multitenant-row-level-security.md).

### Policy

The single most important design decision in the platform.

Every container, image, exec, filesystem, and network operation requires a
`PolicyEvaluator` decision first. Policy only ever subtracts: it can deny a
capability, and it cannot grant one. No schema field, request payload, or
operator flag can override it.

**Every command is adjudicated, declared or not.** Commands are free-form: a user
may type anything, and so may an AI agent acting for one. A command an experience
declared gets a *narrower* evaluation, never a bypass. Hiding a command in the UI
is a discovery decision, not a security decision.

The strongest part of the design is not the chokepoint but the schema. The
experience schema has **no field** for privileged mode, host mounts, host
networking, `docker.sock`, added capabilities, or host namespaces. They are not
"administrator-only" or "off by default" — they are unexpressible, so they cannot
be requested. See [`ADR-0015`](./adr/0015-policy-adjudicates-every-command.md).

Runtime and Execution code reachable without a policy decision is a build
failure, caught by an architecture test.

### Execution is discrete

A command is a list of arguments, never a shell string. There is no shell, no
PTY, no TTY, and no byte stream. An execution streams structured events — started,
output chunk, exit, cancelled — and a transcript block records the command, its
exit code, and its output.

This is what makes the transcript a queryable record rather than a scrollback
buffer. See [`ADR-0013`](./adr/0013-discrete-executions-no-pty.md).

### The contracts

Three versioned JSON Schemas, each generated into TypeScript, C#, and Go:

| Schema | Owner | Path |
|---|---|---|
| Experience | creators publish it | `packages/spec/lazarus.schema.json` |
| Interaction | we own it | `packages/contracts/src/schema/interaction.schema.json` |
| Session | we own it | `packages/contracts/src/schema/session.schema.json` |

They version independently so an internal refactor is not a breaking change to
published creator content. `lazarus.yaml` and `lazarus.json` are one schema in
two encodings. Regeneration is required in the same change, enforced by the
`contract-drift` CI check. See
[`ADR-0016`](./adr/0016-three-versioned-schemas.md).

### Creator content

Documentation is authored content from outside our trust boundary. It is parsed
and validated at **publish time** against an explicit component allow-list. A
document that fails validation is never published. Creator `import`, `export`,
expressions, and arbitrary JSX are not supported, so there is no path from a
document to `eval`. See [`ADR-0017`](./adr/0017-untrusted-creator-content.md).

### Design tokens

Every colour, spacing, radius, shadow, and motion value is defined once in
`packages/tokens`, which imports nothing at all. Raw Tailwind colour utilities,
arbitrary values, and colour functions are build failures everywhere else. Dark
mode swaps semantic tokens rather than adding component-level `dark:` variants.
See [`ADR-0018`](./adr/0018-semantic-tokens-only.md).

### Events

Modules never reference each other. They publish domain events on an in-process
bus and react to each other's events. Dispatch happens after commit.

In-memory dispatch is at-most-once: a crash between commit and handler completion
loses an event. Execution lifecycle events are designated as transitions that must
not be lost and use the durable outbox instead. See
[`ADR-0003`](./adr/0003-in-memory-domain-events.md) and
[`ADR-0013`](./adr/0013-discrete-executions-no-pty.md).

### User history

The transcript, the command history, and read state live in the **client's
IndexedDB**. The server stores a session descriptor only — id, tenant, expiry,
reconnection metadata — and no command text and no output. A transcript is the
most sensitive data we hold, and nothing in the product queries it server-side.
See [`ADR-0019`](./adr/0019-browser-first-user-history.md).

### Secrets

An experience names a secret; it never carries one. Values are encrypted at rest
with `LAZARUS_MASTER_KEY`, redacted in every log and error message, and never
returned by any API. Backups of the database are useless without the master key,
which is why losing it is unrecoverable by design.

### Observability

Structured Serilog logging through `ILogger<T>`. OpenTelemetry exporters, Sentry,
and similar are optional and degrade to no-ops. Self-hosting is not allowed to
mean "your data leaves the machine" — that includes telemetry.

## Request paths

### Publish an experience

```
POST /v1/experiences                 { experience: lazarus.yaml | lazarus.json }
  → Auth:       validate JWT, resolve tenant from claims
  → Experiences: validate against the experience schema, normalise
  → Documentation: parse and validate every MDX document against the allow-list
                  a document that fails is never published
  → Policy:     evaluate; any denial → 403, nothing else runs
  → Secrets:    record references only, no values
  ← 201 + { experienceId, version }
```

Every step is behind Policy. Every step is audited. A published experience is
immutable; a change publishes a new version.

### Start a session

```
POST /v1/sessions                    { experienceId, version }
  → Auth:      validate JWT, resolve tenant from claims
  → Sessions:  rate-limit, quota, enforce per-tenant concurrency
  → Environments: resolve the versioned, digest-pinned image
  → Runtime:   create container, all caps dropped, cgroup limits applied
               no ingress route, no host namespaces, no host mounts
  → Runtime:   attach a temporary writable session layer
  → Sessions:  record a descriptor: id, tenant, expiry, reconnection metadata
  → Audit:     record actor, tenant, environment, expiry
  ← 201 + { sessionId, expiresAt }
```

Note what the descriptor does **not** contain: no command text, no output.

### Execute a command

```
ws(s)://<control-plane>/hubs/exec?sessionId=…
  → Auth:   validate token during the SignalR handshake, group-scope the
            subscription to (tenantId, actorId, sessionId)
  → Execution: build an ExecutionRequest from the draft. An argument list,
               never a shell string
  → Policy: evaluate EVERY command, declared or not. Any denial → the denial is
            published as an event and NO process is created
  → Runtime: exec in the session layer, stream structured events:
             started · output chunk · exit · cancelled
  →        output is exactly what the program printed. Nothing sampled,
             reformatted, completed, or inferred
  → Outbox: ExecutionCompleted is durable, not at-most-once
  → Audit:  record the decision, allow or deny
```

A denied command produces no process at all.

## Deployment topology

A single-box installation:

| Component | Runtime | Notes |
|---|---|---|
| Edge | Caddy | TLS for our own UI and API only. No user workload routing |
| Auth | Node (Better Auth) | `services/auth`, owns the `auth` schema |
| Web | Next.js 16 | `apps/web` |
| Control-plane | .NET 10 | ASP.NET Core, Kestrel |
| Database | Postgres 17 | Single instance, RLS enabled |
| Sessions | rootless podman | Egress-only, no ingress, no host namespaces |

`infra/compose/` is the reference implementation. One-command install is an
acceptance criterion, not an aspiration (`AGENTS.md` §1).

Scaling is deliberately not addressed. Horizontal control-plane scaling needs the
durable outbox and a shared session store first, and pretending otherwise would
be dishonest. See [`ADR-0011`](./adr/0011-self-hostable-before-scalable.md).

## What this architecture is not

Anti-goals, restated because they get reintroduced by accident
(`AGENTS.md` §1):

- **Not a terminal emulator.** No PTY, no `xterm.js`, no `node-pty`, no
  `xterm-addon-*`. Interactive programs needing a TTY are out of scope by design.
- **No flow/node/graph editor.** No canvas, no `reactflow`, no `@xyflow/react`.
- **No CI pipeline.** There is no pipeline. A session is not a build.
- **Sessions are not published.** No subdomain-per-deployment, no long-lived
  publicly reachable service.
- **Not a cloud IDE or dev workspace.** Sessions are for exploration and expire.
- **Not an output simulator.** We never fabricate, infer, or prettify output into
  something the program did not print.
- **Not a general Docker or Kubernetes orchestrator.** No cluster management, no
  scheduler.
- **Not a collaborative or long-lived document store.** Documentation is authored
  content. User history lives in the browser, not a server database.
- **Not a SaaS.** Nothing in the architecture assumes a hosted control plane, and
  `lazarus.dev` is a value in `.env.example`, not a constant in code.

## Further reading

| Document | Contents |
|---|---|
| [`docs/threat-model.md`](./threat-model.md) | Trust boundaries, adversaries, known limitations |
| [`docs/experience-reference.md`](./experience-reference.md) | The experience contract a creator publishes |
| [`docs/contracts-reference.md`](./contracts-reference.md) | The interaction and session contracts we own |
| [`docs/modules/`](./modules/) | Per-module ownership boundaries |
| [`docs/runbooks/`](./runbooks/) | Operational procedures |
| [`docs/adr/`](./adr/) | Decisions, with context and consequences |
| [`AGENTS.md`](../AGENTS.md) | Binding working rules |
| [`TODO.md`](../TODO.md) | Phased plan and current state |
