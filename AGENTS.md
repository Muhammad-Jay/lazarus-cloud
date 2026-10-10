# AGENTS.md

Operating instructions for humans and AI agents working in this repository.

This document describes **how to think, how to behave, how to keep the code
consistent, and how to hold boundaries**. It is the authority on those questions.
When it conflicts with a convenience, the boundary wins. When it conflicts with
an existing file's style, that file is wrong.

Read this before your first change. Read §4 (The Hard Rules) before every change.

---

## 1. What Lazarus Is

Lazarus is an **interactive documentation and software execution platform**. A
creator publishes an *experience*: documentation, a prepared software
environment, and the command knowledge needed to use that software. A user reads
the documentation, composes real commands, executes them in a real isolated
environment, and inspects real results — all in one interface.

Documentation and interaction are **one feature**, not two. Documentation is not a
sidebar attached to a terminal, and a terminal is not the product. The value is
in the connection between them: hovering a command shows what it does, a task
offers the commands that accomplish it, and executing one produces real output in
the same transcript.

Lazarus executes real software. `ls`, `curl`, `git`, `grep` and anything else the
environment provides actually run. Nothing is simulated, and no output is ever
fabricated.

### The four things this product is made of

1. **The experience contract** — `lazarus.yaml` (or `lazarus.json`), validated
   against a versioned JSON Schema. Documentation, environment definition,
   command metadata, and policies. One schema, two encodings.
2. **The interaction model** — workspace context, command draft, suggestions,
   actions, transcript blocks. Framework-independent, and the reason a future
   desktop terminal is possible without a rewrite.
3. **The execution environment** — a versioned, prepared image plus a temporary
   writable session layer. Reproducible, short-lived, and cleaned up by the
   platform.
4. **The transcript** — a structured record of commands, output, documentation,
   and system events. Raw execution results and rich presentation stay
   conceptually separate.

### Anti-goals — never build these

These are *not* Lazarus. A change that reintroduces any of them will be
rejected regardless of how it is phrased.

| Anti-goal | Note |
|---|---|
| A terminal emulator | No PTY. No `xterm.js`, no `node-pty`, no `xterm-addon-*`. Commands are discrete executions with structured results, not a byte stream you type into. |
| A flow / node / graph editor | No canvas, no `reactflow`, no `@xyflow/react`. Ever. |
| A general-purpose CI provider | There is no pipeline. A session is not a build. Stages like `checkout/build/test/scan/deploy` do not exist. |
| Public exposure of user containers | A session is temporary and is not published. No subdomain-per-deployment, no long-lived publicly reachable service. |
| A cloud IDE or dev workspace | Sessions are for exploration and expire. No editor, no file tree you keep, no long-lived workspace. |
| A simulator of command output | Never fabricate, infer, or prettify output into something the program did not print. |
| A general-purpose Docker/Kubernetes orchestrator | We run sessions for *our* users' experiences. We are not a scheduler. |
| A collaborative or long-lived document store | Documentation is authored content, not user-editable documents. User history lives in the browser, not a server database. |

### Self-hostable is a hard constraint

Lazarus must be runnable by one person on one machine with one command, and be
as self-sufficient as its operator allows.

- **No mandatory external dependency.** Postgres, auth, TLS, and storage are
  self-hosted. A hosted control plane is never required to run Lazarus.
- **The base domain is install-time configuration**, never hardcoded. A default
  of `lazarus.dev` is a convenience in `.env.example`, not a constant in code.
- **TLS degrades honestly.** With an owned domain, wildcard ACME. Without one,
  a self-signed CA and a LAN hostname. No code path may assume a real cert.
- **Everything observable is optional-by-default.** OpenTelemetry exporters,
  Sentry, and similar must degrade to no-ops, never to failures.
- **One-command install is an acceptance criterion**, not a nice-to-have. It is
  tested. `infra/compose/` is the reference implementation.

If a change makes self-hosting harder, it needs an ADR.

---

## 2. Architecture at a Glance

```
                         browser ──┐
            Go CLI ───────────────┼──────────────┐
      AI / other software ────────┘              │
            (JWT via JWKS)                       │
                                                 ▼
                                 ┌───────────────────────────┐
                                 │  services/auth            │
                                 │  Better Auth              │
                                 │  owns `auth` PG schema    │
                                 │  ES256 · JWKS at /jwks    │
                                 └─────────────┬─────────────┘
                                               │ publishes keys
                                               │ validates locally
        ┌──────────────────────────────────────┬┴──────────────────────────┐
        │                                     │                             │
        ▼                                     ▼                             ▼
┌────────────────┐                  ┌──────────────────────┐     ┌──────────────────┐
│  apps/web      │  server-side     │  apps/control-plane  │     │  apps/cli        │
│  Next.js 16    │  session cookie  │  .NET 10             │     │  Go 1.26         │
│  composition   │                  │  modular monolith    │     │  `lazarus`       │
│  only          │                  │  SignalR + REST      │     │  tsc + JWT       │
└────────────────┘                  └──────────┬───────────┘     └──────────────────┘
        │                                          │
        │ consumes                          every container,
        ▼                                 exec, and network operation
┌────────────────────────────────┐            is behind PolicyEvaluator
│  packages/interaction          │                   │
│  @lazarus/interaction           │                   ▼
│  framework-free core           │         ┌───────────────────────────┐
│  reducer · transcript · exec   │         │  rootless podman          │
└────────────────────────────────┘         │  exec · stream · cancel   │
                                           └───────────────────────────┘
```

`packages/` holds all TypeScript logic. `apps/web` is composition only.
`packages/interaction` is the only place the interaction model is implemented —
both the web app and the future desktop terminal consume it, which is what makes
a desktop terminal possible without a rewrite.

---

## 3. Repository Map

| Path | Holds | Never holds |
|---|---|---|
| `apps/web` | App Router routes, layouts, page composition, provider wiring | Business logic, data access, state machines, validation, API clients |
| `apps/desktop` | Tauri shell wiring, window lifecycle | Interaction logic. It consumes `packages/interaction` like any other client |
| `apps/cli` | Go command definitions, terminal UI, transport | Business rules. The CLI calls the API; it never re-implements policy |
| `apps/control-plane/src/Lazarus.Domain` | Shared kernel primitives | Business aggregates belonging to a module |
| `apps/control-plane/src/Lazarus.Application` | Cross-module contracts, interfaces | Implementations, EF types, transport concerns |
| `apps/control-plane/src/Lazarus.Contracts` | **Generated** C# types for every JSON Schema | Hand edits. Ever |
| `apps/control-plane/src/Lazarus.Infrastructure` | `DbContext`, migrations, queries, OTel, external clients | Module business rules |
| `apps/control-plane/src/Lazarus.EventBus` | In-process domain event dispatch | Handlers belonging to a module |
| `apps/control-plane/src/Lazarus.Api` | Host, DI wiring, middleware, health | Business logic |
| `apps/control-plane/src/Modules/<M>` | Everything `<M>` owns: Domain, Application, Api | Another module's internals |
| `services/auth` | Better Auth configuration and routes | Lazarus domain logic |
| `packages/contracts` | **Generated only** — interaction, experience, session types | Hand edits. Ever |
| `packages/interaction` | The interaction model: state, reducer, transcript normalisation, exec-event application | React, DOM, Next.js, transport, styling |
| `packages/spec` | `lazarus.schema.json`, TS types, validator | Hand-written copies of generated types |
| `packages/tokens` | The single source of every colour, spacing, radius, shadow, and motion value | Anything else. It has no dependencies at all |
| `packages/feature-*` | A feature slice: state, hooks, validation, presentation | Cross-feature imports |
| `packages/ui` | Design-system primitives | Feature-specific components, raw colour values |
| `packages/config` | Shared eslint, tsconfig, prettier, vitest configuration | Application code |
| `infra/` | Compose files, edge config, Dockerfiles, devcontainer | Application code |
| `docs/adr/` | Decisions, with context and consequences | Status updates without new decisions |

### Decision table — where does my change go?

| If the change is… | It goes in |
|---|---|
| A new UI screen or route | `apps/web/app/**` + logic in `packages/feature-<x>` |
| A reusable presentational component | `packages/ui` |
| A colour, spacing, radius, or motion value | `packages/tokens`, then regenerate. Never a component |
| A change to how the transcript, suggestions, or actions behave | `packages/interaction` |
| A new field in the experience contract | `packages/spec/lazarus.schema.json`, then regenerate |
| A new field in the interaction or session contract | `packages/contracts/src/schema/*.json`, then regenerate |
| A new API endpoint | `Lazarus.Modules.<M>.Api/Controllers` |
| Business logic for module `<M>` | `Lazarus.Modules.<M>.Application` |
| An entity or domain rule of `<M>` | `Lazarus.Modules.<M>.Domain` |
| A cross-module interface | `Lazarus.Application` |
| A cross-module interaction | A domain event on the bus. Never a direct call |
| An EF mapping or query | `Lazarus.Infrastructure` (+ the module's own configuration class) |
| Container/process/network behaviour | `Lazarus.Modules.Runtime`, always behind Policy |

If two answers here both fit, the one that keeps the dependency graph pointing
inward wins. If neither fits, you are about to create a new module — write an
ADR first.

### The frontend package graph

Dependencies point down and inward only. This graph is enforced by lint, not by
review (`AGENTS.md` §4.7).

```
  apps/web          apps/desktop
       │                 │
       └────────┬────────┘
                ▼
        packages/feature-*
                │
                ▼
   packages/ui   packages/api-client  packages/realtime
        │              │                   │
        └──────┬───────┴───────────────────┘
               ▼
      packages/interaction   packages/tokens
               │                  ▲
               ▼                  │
        packages/contracts ───────┘   (tokens has no dependencies at all)
```

- `packages/tokens` imports **nothing**. It is a leaf.
- `packages/contracts` imports **nothing**. It is generated types only.
- `packages/interaction` imports only `packages/contracts`. No React, no DOM.
- `packages/feature-*` never imports `packages/feature-*`.
- Nothing imports another package's `src/`. Subpath exports are the only door.

---

## 4. The Hard Rules

These are non-negotiable. Several are enforced by CI, which means a violation
fails the build rather than failing review.

### 4.1 Layer direction

```
Api  →  Application  →  Domain
                        ↑
              Infrastructure
```

- `Lazarus.Domain` references **nothing**. No other project, no framework.
- `Lazarus.Application` references `Lazarus.Domain` only.
- `Lazarus.Infrastructure` references `Lazarus.Application` and `Lazarus.Domain`.
- `Lazarus.Api` references everything above, and registers it.
- Dependencies point inward. There is no exception and no `InternalsVisibleTo`
  loophole for convenience.

### 4.2 Module isolation

- A module never references another module's `Domain`, `Application`, or
  `Infrastructure` project.
- Cross-module reads go through **DTOs declared in `Lazarus.Application`**, or
  through the **event bus**. Never a direct entity reference, never a
  navigation property, never a join that spans two modules' aggregates.
- Each module owns its entities and its `IEntityTypeConfiguration<T>` classes.
  `Lazarus.Infrastructure` owns the `DbContext`, the connection, tenancy
  resolution, and migrations.
- Modules are internally `public` but externally sealed. If module `A` needs
  something from module `B`, either it belongs in `Lazarus.Application`, or
  `B` publishes an event and `A` reacts.

### 4.3 Controllers are translation only

A controller may: bind and validate input, call exactly one Application use
case, and map the result to a response. It may not: contain business rules,
touch `DbContext`, call EF, emit events directly, or orchestrate multiple use
cases. If a controller exceeds ~40 lines, the logic belongs in Application.

### 4.4 Shared kernel discipline

`Lazarus.Domain` holds only genuinely cross-cutting primitives:
`Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`, `IDomainEvent`,
`TenantId`, `Result<T>`, `Error`, `IClock`.

A business aggregate never moves here, even if two modules want it. That is the
signal that the aggregate is actually two things, or that a module boundary is
wrong. Promote nothing without an ADR.

### 4.5 The Policy rule

**No container, image, exec, filesystem, or network operation may execute
without a `PolicyEvaluator` decision.**

- Policy is a **chokepoint**, not a check sprinkled at call sites.
- Policy **only ever subtracts**. It can deny a capability. It can never grant
  one, and it cannot be overridden by a spec, a request payload, or an operator
  flag.
- **Commands are free-form.** A user may type anything, and so may an AI agent
  acting for one. `PolicyEvaluator` therefore adjudicates *every* execution at
  runtime, not only the commands an experience declared. A command the
  experience declared gets a narrower evaluation, never a bypass.
- Hiding a command in the UI is a **discovery** decision, not a security
  decision. If it must not run, Policy says so.
- The schema has **no field** for privileged mode, host mounts, host networking,
  `docker.sock`, added capabilities, or host namespaces. They are not "disabled
  by default" — they are **not expressible**. A user cannot write a request that
  asks for them.
- Deny by default. Unknown image, unlisted base, unbounded resource, unlisted
  registry → **deny**.
- `Runtime` and `Execution` code that can be reached without a policy decision is
  a build failure, caught by an architecture test. Do not look for a way around
  the test.

### 4.6 The contract is the contract

- `packages/spec/lazarus.schema.json` describes the **experience** (published
  by a creator). `packages/contracts/src/schema/*.json` describes the
  **interaction** and **session** wire shapes. All are authoritative.
- Never hand-edit a generated type in C#, TypeScript, or Go. Change the schema,
  regenerate, commit every target.
- A schema change ships in the same PR as its regeneration and its reference-doc
  update (`docs/experience-reference.md` or `docs/contracts-reference.md`). A
  schema change without regeneration fails `contract-drift` CI.
- Additive schema changes (new optional fields) are minor. Removals, renames,
  and type changes are breaking, require a new schema `apiVersion`, and require a
  migration path for existing experiences.
- `lazarus.yaml` and `lazarus.json` are **the same schema in two encodings**.
  `lazarus.json` exists because AI agents and CI callers post JSON. It is not a
  second contract, and there is never a `lazarus.json` whose shape the YAML
  encoding cannot express.

### 4.7 Boundaries are enforced, not reviewed

- `packages/tokens`, `packages/contracts`, and `packages/interaction` are
  **leaves**. `packages/tokens` imports nothing at all. `packages/contracts`
  imports nothing. `packages/interaction` imports only `packages/contracts`.
- A package that imports another package's `src/` is a **build failure**.
  Subpath exports are the only door between packages.
- A **phantom dependency** — importing a package that is not in your
  `package.json` — is a build failure. Every import is declared and every
  declared dependency is used.
- Raw visual values outside `packages/tokens` are build failures: raw Tailwind
  colour utilities (`bg-red-500`), arbitrary values (`bg-[#0f172a]`), colour
  functions (`rgb()`, `hsl()`, `oklch()`), and inline `style={{}}` carrying
  visual properties. Semantic tokens are the only public surface.
- Layer direction (`Api → Application → Domain`), module isolation, and the
  policy chokepoint are **NetArchTest** rules. A violation fails the build.

### 4.8 The interaction model is implemented once

The interaction model lives in `packages/interaction` and nowhere else.

- State transitions are a **pure reducer**. No React, no DOM, no fetch, no
  storage, no timers.
- Reducer input and output are plain values, so the web app, the CLI, and a
  desktop shell all drive the same transitions.
- Execution is an **event stream** applied to the reducer. Output arrives as
  `ExecutionEvent`s; it is never read back from a component's local state.
- The transcript is **normalised once**, at the point an `ExecutionEvent`
  becomes a `TranscriptBlock`. Presentation consumes blocks; it never parses raw
  output itself.
- Anything a second client would need to reimplement — tokenisation, suggestion
  ranking, transcript ordering, draft-conflict resolution — is a bug, not a
  feature.

### 4.9 Creator content is untrusted

Documentation is authored content compiled from a creator's machine. It is not
trusted code.

- MDX is **parsed and validated at publish time**, not rendered as-is at read
  time. A document that fails validation is never published.
- Only components on the **explicit allow-list** may appear. Unknown component
  names are a validation error.
- Creator `import`, `export`, expressions, `{/* */}` evaluation, and arbitrary
  JSX are **not supported**. There is no path from a document to `eval`.
- No remote image or script origin is reachable from a document without a
  publish-time allow-list check.
- Rich output rendering must escape. An ANSI sequence is a colour and a
  control-character filter, never `innerHTML`.

### 4.10 Generated code is generated

Anything under `packages/contracts/src/generated`, `Lazarus.Contracts`, and the
Go spec types is generated. Edits are lost on the next run. Fix the generator
instead.

---

## 5. Consistency Rules

**One way to do a thing.** If two implementations of the same concept exist,
one is deleted in the same PR that introduces the other. Parallel
implementations are the single most common cause of bugs in a codebase this
size — they drift, and only one of them gets fixed.

| Concern | The one way |
|---|---|
| Expected-failure handling | `Result<T>` / `Error`. Never exceptions for business outcomes |
| Programming-error failures | Exceptions, never caught-and-wrapped |
| HTTP error shape | RFC 9457 `ProblemDetails`, single error middleware |
| Realtime transport | SignalR, typed hubs, tenant-scoped groups |
| Command/query entry | Application use-case handlers. Never a controller calling a repo directly |
| The interaction model | `packages/interaction`. Never reimplemented in a client |
| Visual values | `packages/tokens`. Never a literal in a component |
| User history | Browser IndexedDB. The server stores TTL metadata only |
| Logging | Serilog structured logging through `ILogger<T>`; `console.log` is banned in .NET |
| Logging (TS) | One logger wrapper per package; no `console.*` in `packages/` |
| Naming (C#) | `PascalCase` types/methods, `camelCase` locals, `_camelCase` private fields, file name = type name |
| Naming (TS) | `kebab-case` files and folders; `PascalCase.tsx` components; `useThing.ts` hooks |
| Naming (Go) | Go conventions: short lowercase packages, no underscores, `Err`-prefixed error vars, `%w` wrapping |
| Naming (SQL) | `snake_case` tables prefixed by owning module (`exp_`, `doc_`, `env_`, `ses_`, `exec_`, `pol_`, `ten_`, `idn_`, `aud_`) |
| Config | Typed options classes, validated at startup. No string-typed lookups |
| Time | `IClock` in .NET, one injected `Date` source in TS. Never `Date.now()` in domain logic |
| IDs | `Guid`/UUID everywhere. Never a hardcoded ID, ever |

### The banned list

These are not style opinions. Each is a defect this repository has already
suffered from:

- `any`, `as any`, `any[]` outside a single justified interop boundary
- `@ts-ignore` · `@ts-expect-error` · `eslint-disable` · `#pragma warning disable`
- `strict: false` · `ignoreBuildErrors` · `ignoreDuringBuilds`
- Empty `catch`, or `catch` that only logs
- `.js` files in a TypeScript project
- Nested `new Promise` inside an async function
- `resolve()` followed by `reject()`
- Interpolated shell command strings. Use `ProcessStartInfo.ArgumentList` / `execFile`
- A module importing a sibling module
- A controller containing business logic
- A raw Tailwind colour utility, an arbitrary colour value, or an inline style
  carrying a visual property, anywhere outside `packages/tokens`
- `xterm.js`, `node-pty`, `@xterm/*` — a terminal emulator is an anti-goal
- Fabricating, sampling, or reformatting command output that the program did not
  print
- Hardcoded URLs, ports, hostnames, IDs, emails, or paths
- Secrets in source, in `.env` files committed, in logs, or in error messages
- Two `.gitignore`s where one would do

---

## 6. Type Discipline

- Types are the contract. If you cannot type it, you do not understand it yet.
- New C# and TypeScript code is nullable-clean. Nullability is not disabled to
  make an error go away.
- `strict: false` and `ignoreBuildErrors` do not exist in this repo. If the build
  fails on types, fix the types.
- Domain types are explicit: `ValueObject`s over primitive obsession, and
  validated invariants at construction. An `int` that must be 1-65535 is a
  `Port` value object.
- Union types over optional flags. A shape that is sometimes A and sometimes B is
  a discriminated union, not `{ kind?: string }`.
- Prefer exhaustive `switch` over if-chains so the compiler catches missing cases.

---

## 7. Security Rules

Every session is an untrusted-input-to-RCE path. A user types arbitrary commands,
and an AI agent may type arbitrary commands for them. Treat both as hostile
input at all times.

- **Tenant scope comes from the validated token. Never from a request body, a
  query parameter, or a URL segment.** A caller may never choose their tenant.
- **Path containment before any filesystem write.** Canonicalise the path, then
  assert the result is inside the intended root. Every time. No exceptions, not
  even "it's an internal path".
- **No shell.** `ProcessStartInfo` with `ArgumentList`, or `execFile`. A command
  is a list of arguments, never a string.
- **Secrets by reference, never by value.** An experience names a secret; it
  never carries one. Values are encrypted at rest, redacted in every log and
  error, and never returned by any API.
- **Least privilege at every layer.** Rootless podman, dropped capabilities,
  `no-new-privileges`, seccomp, read-only rootfs where possible, cgroup memory/
  CPU/PID caps, no host namespaces, no host mounts.
- **Images are allowlisted and digest-pinned.** A tag is not an identity.
- **Network egress is policy-controlled.** Not "allowed by default".
- **Every privileged action is audited** — actor, tenant, target, decision,
  timestamp. Audit is not optional and not best-effort.
- **Rate-limit and quota every write path**, especially session start and command
  submission.
- Verify signatures on inbound webhooks. Never trust a webhook body.

Report vulnerabilities privately per `SECURITY.md`. Do not open a public issue
for a security bug, and do not include live credentials in a report.

---

## 8. Async, Cancellation, and Timeouts

- `CancellationToken` flows from the transport boundary to the podman call. If a
  method does not accept one, that is a bug unless it is genuinely synchronous.
- **No fire-and-forget.** No `.Result`, no `.Wait()`, no un-awaited `Task`, no
  `void` async, no detached background work without an explicit, named,
  supervised mechanism.
- Every external call has a timeout. Podman calls, HTTP calls, database calls.
  "It usually returns" is not a timeout policy.
- Concurrent container operations are bounded. A per-tenant concurrency limit is
  enforced, not hoped for.
- Streams (logs, terminal output) have backpressure and an idle timeout. An
  unbounded `Channel` fed by an unbounded process is an outage waiting for a
  busy deploy.

---

## 9. Events and Side Effects

- A domain event is a statement of fact in the past tense: `SessionCreated`,
  `CommandSubmitted`, `ExecutionCompleted`, `ExperiencePublished`. Never
  `DoBuild` or `PleaseBuild`.
- Handlers are **idempotent** and **retry-safe**. Assume delivery happens twice.
- **A handler never calls another module.** It reacts through the bus.
- A handler never holds a database transaction open across a process spawn or a
  network call. Dispatch happens **after** commit.
- In-memory dispatch is at-most-once. Events are lost if the process dies between
  commit and handler completion. If a transition must not be lost, it goes
  through the durable outbox (`ADR-0003`). Do not silently assume durability.
- Events are part of the module's public API. Changing one is a breaking change
  for every subscriber.

---

## 10. Testing

Test the layer that owns the logic, at the cheapest level that can catch the bug.

| Logic | Test with |
|---|---|
| Domain rule, value object | Unit test, no I/O, fast, exhaustive |
| Application use case | Unit test with fakes for ports |
| EF mapping, query, RLS | Integration test on real Postgres via **Testcontainers** |
| Policy decision | Table-driven unit test over the full decision matrix |
| Runtime (podman) | Integration test against real podman, skipped when unavailable |
| REST + SignalR endpoint | `WebApplicationFactory`, real auth pipeline |
| Schema (experience, interaction, session) | Golden-file tests: every fixture must parse to an expected model |
| Interaction reducer | Vitest, table-driven over every action×event pair |
| `packages/*` TS | Vitest + Testing Library |
| Critical user journeys | Playwright |
| Architecture rules | NetArchTest — a violation is a failing test |

Rules:

- **A bug fix ships with a test that fails before the fix.** If you cannot write
  the failing test, you have not found the bug yet.
- No test hits the network, a real cloud API, or a real developer's filesystem.
- No test asserts on log strings or exact wording. Assert on state and effect.
- No `sleep`. Use deterministic clocks and explicit awaitables.
- CI is the gate. Do not merge with a red build, and do not weaken a test to get
  green.

---

## 11. Git Conventions

- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `build:`, `ci:`, `chore:`, `perf:`, `security:`. Optional scope in parens.
- Branches: `feat/short-description`, `fix/…`, `chore/…`, `docs/…`, matching a
  `TODO.md` phase ID where relevant (`feat/p07-policy-enforcement`).
- **No force-push to a shared branch.** No rewriting published history.
- One logical change per PR. A refactor and a behaviour change do not travel
  together, even when tempting.
- Never commit generated output that a CI step regenerates, unless the PR is
  specifically the regeneration.
- Never commit secrets, `.env` files, credentials, or `node_modules`.
- PR description states what changed, why, how it was verified, and which ADR or
  `TODO.md` item it satisfies.
- CI green is required. If CI is wrong, fix CI in its own PR.

---

## 12. How to Work Here

Applies to every change, and especially to an AI agent.

1. **Read before writing.** `AGENTS.md`, the relevant `docs/modules/<name>.md`,
   and the ADR for the area. Understand the existing shape before adding to it.
2. **Start from the contract.** For anything user-facing, the schema or the
   OpenAPI/typed-hub contract comes first. Then the domain. Then the transport.
   Then the UI.
3. **Push logic inward.** Transport gets thinner as you go. Logic belongs at the
   innermost layer that can own it.
4. **Smallest viable diff.** Do not reorganise code you are not changing. Do not
   "improve" adjacent code. Do not reformat unrelated lines.
5. **Prefer deleting.** A new file that makes an existing file redundant is a
   delete, not an addition.
6. **Never disable a check to go green.** Not a lint, not a test, not a type
   error, not a build flag. Fix the cause.
7. **Update the docs you invalidate.** Moving a boundary means updating
   `docs/modules/<name>.md`. Changing the schema means updating
   `docs/experience-reference.md` or `docs/contracts-reference.md`, and
   regenerating.
8. **Ask before expanding scope.** If a fix reveals a larger problem, report it
   and propose it — do not silently absorb it into the current change.
9. **State what you did not do.** If you left something out, say so explicitly.
10. **Verify before claiming.** Run the build, the tests, and the lint. Report
    actual output, not expected output.

---

## 13. Definition of Done

A change is done when all of these are true.

- [ ] It satisfies an item in `TODO.md`, or is explicitly unblocked work
- [ ] It respects every rule in §4 and does not add a new way to do something
- [ ] `just check` passes: format, lint, build, test, typecheck across all languages
- [ ] New logic has tests at the layer that owns it; a fix has a test that failed first
- [ ] No `any`, no `@ts-ignore`, no `eslint-disable`, no empty `catch`
- [ ] No new hardcoded URL, port, hostname, ID, email, path, or secret
- [ ] Tenant scoping derives from the token, and the query actually filters by it
- [ ] Any container/process/network path goes through `PolicyEvaluator`
- [ ] Any interaction logic lives in `packages/interaction`, not in a client
- [ ] Any visual value comes from a semantic token in `packages/tokens`
- [ ] Generated code regenerated and committed if its source changed
- [ ] Boundary moves documented in `docs/modules/<name>.md`
- [ ] Schema changes ship with regenerated C#, TS, and Go types
- [ ] Cancellation flows end to end; every external call has a timeout
- [ ] Privilege-affecting actions are audited
- [ ] Docs updated: `README`, `docs/architecture.md`, `SECURITY.md` as applicable
- [ ] No secrets in the diff

---

## 14. When to Stop and Ask

Ask before proceeding when:

- A rule in §4 would need to be broken or reinterpreted
- A module boundary is genuinely unclear — that is an architecture problem, not a coding problem
- A schema change is breaking, and the migration path is not obvious
- Security-relevant behaviour is being loosened for convenience
- A change would require a new external dependency
- Self-hosting would be made harder
- You are about to add a third implementation of something that already has two

Disagreement with this document is expected and healthy. Raise it as an ADR
proposal rather than working around it silently.
