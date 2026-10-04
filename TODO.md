# TODO.md

Implementation plan for Lazarus. Every item is numbered `<phase>.<seq>` and is
designed to be picked up and completed independently, in order, by one person or
one agent.

Phases are ordered so that any prefix is shippable. Do not start a phase before
its dependencies are green.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Phase 0 — Security triage

> **Owner: repository owner.** These are dashboard actions, not code changes.
> Nothing else in this plan matters until they are done.
>
> **None of these can be done in the repository.** Revoking a credential happens
> at the provider, authenticated as you. No code change makes a leaked token
> safe — deleting the file that contained it does not invalidate it.

- [x] **0.1** Revoke the GitHub classic personal access token committed at
      `lib/github.test.ts:4` in `Lazarus-Cloud-Automation-Platform`. **This is the
      highest-priority item in the repository.**

  *Verified live on 2026-10-02.* That repository is public and its current default
  branch still contains a matching 40-character `ghp_` token, committed as a
  literal rather than read from an environment variable. This is not a
  historical exposure and the file has not been removed. The earlier
  `front-end/lib/github.test.ts` path in this item was wrong: the leak is at the
  repository root.

  The token is **account-scoped, not repo-scoped**. A classic PAT with `repo`
  permissions reaches every repository the account owns, private ones included,
  so it also reached `lazarus-cloud`. That repository needs no cleanup of its
  own — it is private, has three clean commits, contains no credential-shaped
  string, and CI now blocks recurrence — but its privacy is a reason to revoke
  promptly, not a reason to skip it.

  There is no API that lets a token revoke itself, and the leaked credential must
  not be used to perform its own revocation.

  1. Open <https://github.com/settings/tokens> (personal) or
     <https://github.com/settings/tokens?type=organization> (org).
  2. Revoke **every** token you cannot positively identify. Do not try to work out
     which one it was from the deleted file — revoke all, then re-create only the
     ones still in use. A token's scopes are the only thing that indicates which,
     and the copy in the public repository cannot be trusted as the reference.
  3. Under **Settings → Developer settings → GitHub Apps**, revoke any GitHub App
     installation whose permissions look unfamiliar. A leaked PAT is often
     accompanied by a forgotten app install.
  4. Check <https://github.com/settings/security-log> for activity you cannot
     account for.
  5. Delete or make private `Lazarus-Cloud-Automation-Platform`. It is not needed:
     the product line it carried was closed in `ADR-0008` and the work continues in
     `lazarus-cloud`. While it stays public it keeps handing this account's
     credentials to anyone who clones it, and deleting it revokes the file's
     distribution rather than only the account's use of the token.
  6. Confirm at <https://github.com/settings/developers> that the revoked token
     no longer appears.
  7. Contact GitHub Support to request cache purging. Revocation stops future use;
     it does not unpublish what was already indexed.

  A token revoked after being public for any meaningful period is **assumed
  compromised**. Re-create with the narrowest scopes that work, and a short
  expiry — not a clone of what it had.

  *Recurrence is now caught:* `just secrets` runs gitleaks against the working tree
  and full history using `.gitleaks.toml`, and CI runs the same check
  unconditionally. A PAT-shaped string in a commit now fails the build.
- [x] **0.2** Rotate the Supabase anon key exposed in `front-end/.env.local`.
      Supabase is being removed entirely; the key must be invalidated so the
      deleted `.env.local` is not a live credential.
- [x] **0.3** Surveyed the legacy trees before deletion. Variable *names* only,
      never values:

  | File | Variables found |
  |---|---|
  | `front-end/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
  | `backend/.env.local` | `DOCKER_HOST` |
  | `lazarus-cli/.env` | `API_ENDPOINT` |
  | `main-backend/.env.local` | *(empty)* |

  All four files were deleted with the trees. Rotate `DOCKER_HOST` only if the
  value was ever a shared or non-local socket.
- [ ] **0.4** ~~Add `.gitignore` at root and re-verify with
      `git status --ignored` before the first commit that the legacy trees are
      untracked.~~ Superseded: the legacy trees were deleted outright
      (`ADR-0008`), so there is nothing to untrack. Retained as a standing rule —
      `.gitignore` must cover the same classes of path for new work (done in
      `1.3`).
- [ ] **0.5** Install Node 22 on the development machine. `.tool-versions` and
      `package.json#engines` both require `>=22`, and the current shell runs
      Node `v20.19.5`, which makes pnpm emit an `Unsupported engine` warning on
      every command. It warns rather than fails, so nothing is blocked — but a
      green run on an unsupported Node is not a real verification.

**Accept:** tokens revoked, `git grep` for the old token prefix returns nothing
in any commit, and no `.env*` file is tracked.

The `git grep` condition is about *this* repository's history only. It already
passes, and passing it means nothing about `0.1` on its own — the credential
lives in a different repository's history. Do not read a clean scan here as
evidence that the token is safe to keep.

---

## Phase 1 — Wipe and repository foundation

- [x] **1.1** Delete `front-end/`, `main-backend/`, `lazarus-cli/`, `backend/`,
      `.idea/`, and every nested `.git/` and `node_modules/`. The old product
      lines are closed; nothing is salvaged (`ADR-0008`).
      *Verified: `find` for `node_modules`, `.git`, `.env*`, and lockfiles
      returns nothing; the tree went from 1.6 GB / 5,125 files to 64 KB / 2 files.*
- [x] **1.2** `git init` at root with a single initial commit. One repo, one
      history, no nested repos.
- [x] **1.3** Root tooling: `.gitignore`, `.editorconfig`, `.gitattributes`,
      `.dockerignore`, `.tool-versions`.
- [x] **1.4** `global.json` pinning .NET SDK `10.0.112`.
- [x] **1.5** `go.work` using `./apps/cli`; minimal `go.mod` + `main.go` so the
      workspace resolves and `go build ./...` passes.
      *Verified: `go -C apps/cli build`, `vet`, and `test ./...` all succeed and
      `gofmt -l apps/cli` is empty. Note `go build ./...` from the workspace root
      fails by design — the root is not a module — so the `justfile` uses
      `go -C apps/cli`.*
- [x] **1.6** `pnpm-workspace.yaml` covering `apps/web`, `services/auth`,
      `packages/*`. Root `package.json` private, pinning `packageManager`.
      *No `workspaces` field in `package.json`: `pnpm-workspace.yaml` is the single
      source of workspace truth, and a second one would be a second answer.*
- [x] **1.7** `justfile` with `dev`, `check`, `test`, `codegen`, and per-language
      targets (`AGENTS.md` §13 depends on `just check`).
      *Every recipe guards on a marker file, not a directory, and prints `skipped`
      when the project is absent. Verified necessary: `dotnet format` on a
      directory with no solution exits 128 with an unhandled exception.*
- [x] **1.8** `.github/`: path-scoped `ci.yml` and `contract-drift.yml` skeletons
      that pass on a repo with no code, plus `CODEOWNERS`, `dependabot.yml`,
      `PULL_REQUEST_TEMPLATE.md`.
      *Verified: all six YAML documents parse. `secrets`, `hygiene`, and
      `contract-drift` are unconditional from the first commit; language jobs are
      conditional on their files existing.*
- [x] **1.9** `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`,
      `LICENSE` (MIT).
- [x] **1.10** `docs/architecture.md`, `docs/threat-model.md`.
- [x] **1.11** `docs/adr/0001`–`0011` recording every decision already made.

**Accept:** `git status` clean; `just check` runs green on an empty repo;
`find . -name .git -o -name node_modules` returns only `./.git`;
`go -C apps/cli build ./...` succeeds.

**Risk:** low. The irreversible part is `1.1` — history is intentionally discarded
per `ADR-0008`, and `0.3` must be complete first.

---

## Phase 2 — Contracts

The contracts everything else obeys. Nothing user-facing starts before this.
Three schemas, each versioned independently (`ADR-0016`).

- [ ] **2.1** `packages/spec/lazarus.schema.json` — the **experience** contract:
      `apiVersion`, `title`, `description`, `documentation[]`, `environment`,
      `commands[]`, `tasks[]`, `secrets[]`, `policies`. One schema, two
      encodings: `lazarus.yaml` for humans, `lazarus.json` for agents and CI.
      *Deliberately absent:* any field for privileged mode, host mounts, host
      networking, `docker.sock`, added capabilities, or host namespaces. They are
      not expressible, so no request can ask for them (`ADR-0015`).
- [ ] **2.2** `packages/contracts/src/schema/interaction.schema.json` — state
      shapes, `CommandDraft`, `CommandSuggestion`, `Action`, `DocumentationRef`,
      `TranscriptBlock`, `InlineContent`, `ExecutionRequest`, `ExecutionEvent`,
      `RichOutput`.
- [ ] **2.3** `packages/contracts/src/schema/session.schema.json` — session
      descriptor, TTL, reconnection metadata, workspace context.
      *No command text and no output. The server does not hold history
      (`ADR-0019`).*
- [ ] **2.4** Every schema declares `$id` with an `apiVersion`, is
      `additionalProperties: false` at each object level unless a field is
      explicitly open, and uses discriminated unions rather than optional flags.
- [ ] **2.5** Golden-file tests: each fixture parses to an expected model, and
      each rejected fixture is rejected for a **named** reason.
- [ ] **2.6** `docs/experience-reference.md` and `docs/contracts-reference.md`.
      Delete `docs/spec-reference.md`.
- [ ] **2.7** `contract-drift` CI fails when a schema changes without its
      regeneration or its reference doc.

**Accept:** `pnpm -F @lazarus/contracts test` green; every schema validates its
fixtures; drift CI fails on a deliberately broken regeneration.

**Risk:** low, but this is the keystone. Everything downstream is generated from
it, so a wrong decision here is expensive and a broken regeneration here is cheap
to fix.

---

## Phase 3 — Code generation targets

- [ ] **3.1** Generate TypeScript types into
      `packages/contracts/src/generated` and `Lazarus.Contracts` from the same
      schemas. Generated output is committed.
- [ ] **3.2** Generate the Go spec types in `apps/cli` from the experience schema.
- [ ] **3.3** Generator is deterministic: same schema in, byte-identical output
      out. Sorted keys, no timestamps in generated files.
- [ ] **3.4** `just codegen` regenerates every target, and `just check` fails if
      regeneration produces a diff.
- [ ] **3.5** Never hand-edited, enforced by a header check over
      `packages/contracts/src/generated` and `Lazarus.Contracts`.

**Accept:** `just codegen && git diff --exit-code` is clean on an unchanged tree;
a schema edit without regeneration fails `just check`.

**Risk:** low.

---

## Phase 4 — Design tokens

- [ ] **4.1** `packages/tokens` imports nothing at all. One source of truth for
      colour, spacing, radius, shadow, and motion.
- [ ] **4.2** Semantic names describe **role**, not order: `--surface-raised`,
      `--text-muted`. No `--surface-3`.
- [ ] **4.3** Generate CSS custom properties and a TS module from that one source,
      so the CSS and TS surfaces cannot drift. Output is committed.
- [ ] **4.4** Light and dark themes defined as token values. Dark mode swaps
      tokens; it adds **no** component-level `dark:` variants.
- [ ] **4.5** Tokens are contrast-checked in both themes and the check is a test.
- [ ] **4.6** The raw palette is referenceable **only** inside `packages/tokens`.

**Accept:** `packages/tokens` has zero dependencies; every token used elsewhere
resolves; contrast tests pass in both themes.

**Risk:** low.

---

## Phase 5 — Boundary enforcement

Rules that are enforced rather than reviewed (`AGENTS.md` §4.7).

- [ ] **5.1** Declare the frontend package graph as data. Lint fails on any edge
      that is not in it.
- [ ] **5.2** `packages/tokens`, `packages/contracts`, `packages/interaction` are
      leaves with a fixed, minimal dependency set. Growth fails the build.
- [ ] **5.3** Deep imports are banned. Subpath exports are the only door between
      packages.
- [ ] **5.4** **Phantom dependency** check: importing a package not declared in
      the importing package's `package.json` fails. Every declared dependency is
      also checked to be used.
- [ ] **5.5** Ban raw visual values outside `packages/tokens`: Tailwind colour
      utilities, arbitrary values, `rgb()`/`hsl()`/`oklch()`, and `style={{}}`
      carrying a visual property (`ADR-0018`).
- [ ] **5.6** Banned-pattern rules for the existing list: `any`, `@ts-ignore`,
      `@ts-expect-error`, `eslint-disable`, empty `catch`, `.js` in a TS project.
- [ ] **5.7** `packages/interaction` must not import React, DOM types, or any
      transport. A new dependency there fails the build.

**Accept:** each rule has a test that fails on a deliberately violating fixture;
`pnpm lint` is green on a clean tree.

**Risk:** low. Annoying when it fires on a legitimate case, which is the intent.

---

## Phase 6 — The interaction core

`@lazarus/interaction`. Framework-free. Imports only `@lazarus/contracts`
(`ADR-0014`).

- [ ] **6.1** State shape and a pure `(state, action) => state` reducer. No
      React, DOM, fetch, storage, or timers.
- [ ] **6.2** Execution arrives as an `ExecutionEvent` stream applied to the
      reducer. Output is never read back out of component state.
- [ ] **6.3** Transcript normalisation, done **once**, where an `ExecutionEvent`
      becomes a `TranscriptBlock`. Presentation consumes blocks and never parses
      raw output or reorders blocks.
- [ ] **6.4** Suggestion ranking, in the package. A client never ranks.
- [ ] **6.5** Draft-conflict resolution: a context change replaces only an
      unmodified draft; an edited draft produces `draftConflict` and the UI asks.
- [ ] **6.6** ANSI to colour mapping is a **filter**, not an emulator. Cursor and
      erase semantics are stripped. Never `innerHTML` (`ADR-0013`).
- [ ] **6.7** Table-driven Vitest suite over every action×event pair.

**Accept:** `pnpm -F @lazarus/interaction test` green; the package's dependency
list is exactly `@lazarus/contracts`; a table-driven case exists for each action
and each event.

**Risk:** medium. This is the piece a second client would otherwise
reimplement, so an under-specified transition here becomes a divergence later.

---

## Phase 7 — Control-plane skeleton

- [ ] **7.1** `Lazarus.Domain`, `Lazarus.Application`, `Lazarus.Contracts`,
      `Lazarus.Infrastructure`, `Lazarus.EventBus`, `Lazarus.Api`. Layer direction
      enforced by NetArchTest (`AGENTS.md` §4.1).
- [ ] **7.2** Shared kernel holds only `Entity`, `AggregateRoot`, `ValueObject`,
      `DomainEvent`, `IDomainEvent`, `TenantId`, `Result<T>`, `Error`, `IClock`.
- [ ] **7.3** Modules: `Experiences`, `Documentation`, `Environments`, `Sessions`,
      `Execution`, `Policy`, `Runtime`, `Tenancy`, `Identity`, `Audit`. Ten
      modules, each owning its entities and EF configuration.
- [ ] **7.4** Module isolation is a NetArchTest rule: no module references another
      module's `Domain`, `Application`, or `Infrastructure` project.
- [ ] **7.5** Controllers are translation only, and a NetArchTest fails one that
      exceeds the line budget.
- [ ] **7.6** Typed options classes validated at startup. No string-typed
      configuration lookups.

**Accept:** `dotnet build` and `dotnet test` green; architecture tests fail on a
deliberate violation of layer direction or module isolation.

**Risk:** low.

---

## Phase 8 — EventBus and the durable outbox

- [ ] **8.1** In-process dispatch, at-most-once, for transitions that may be lost.
- [ ] **8.2** Durable outbox for transitions that must not be lost. **Execution
      lifecycle events are designated as such** (`ADR-0013`).
- [ ] **8.3** Dispatch happens **after** commit. A handler never holds a
      transaction open across a process spawn or a network call.
- [ ] **8.4** Handlers are idempotent and retry-safe. A handler never calls
      another module.
- [ ] **8.5** Events are past-tense facts: `SessionCreated`, `CommandSubmitted`,
      `ExecutionCompleted`, `ExperiencePublished`.

**Accept:** a handler replayed twice produces the same state; a crash between
commit and handler completion does not lose an execution event.

**Risk:** medium.

---

## Phase 9 — Auth service

- [ ] **9.1** `services/auth` (Better Auth) owns the `auth` PostgreSQL schema and
      publishes ES256 JWKS.
- [ ] **9.2** The control plane validates the **standard ES256/JWKS token**
      locally. It does not reference Better Auth framework types or internals —
      it is a JWKS consumer, not a Better Auth client (`ADR-0004`).
- [ ] **9.3** Nothing in the platform requires a network call to validate an
      identity.
- [ ] **9.4** `apps/web` holds a server-side session cookie. The browser never
      receives a long-lived API credential.

**Accept:** a token minted by `services/auth` is accepted by the control plane
with the auth service stopped.

**Risk:** low.

---

## Phase 10 — Tenancy and identity

- [ ] **10.1** Multi-tenancy with PostgreSQL row-level security, on top of
      `ADR-0005`.
- [ ] **10.2** Tenant scope comes from the **validated token**, never a body,
      query parameter, or URL segment. A caller may never choose their tenant.
- [ ] **10.3** Every query actually filters by tenant. An integration test asserts
      this against real Postgres via Testcontainers.
- [ ] **10.4** Cross-module reads go through DTOs in `Lazarus.Application` or the
      event bus. Never an entity reference or a cross-module join.

**Accept:** a token for tenant A cannot read tenant B's rows through any endpoint;
the RLS integration test fails if the filter is removed.

**Risk:** medium. This is the single highest-value security test in the backend.

---

## Phase 11 — Policy — the chokepoint

- [ ] **11.1** `PolicyEvaluator` adjudicates **every** execution at runtime,
      declared or not (`ADR-0015`).
- [ ] **11.2** Policy only ever subtracts. No request field, spec field, or
      operator flag grants a capability.
- [ ] **11.3** Deny by default. Unknown image, unlisted base, unbounded resource,
      unlisted registry → deny.
- [ ] **11.4** Policy is a chokepoint. NetArchTest fails if reachable `Runtime` or
      `Execution` code has no policy decision in its path.
- [ ] **11.5** Every decision is audited: actor, tenant, target, decision, reason,
      timestamp. A denial is as auditable as an allow.
- [ ] **11.6** Table-driven unit tests over the **full** decision matrix,
      including every denial reason.
- [ ] **11.7** Denials are explanatory. A user typing something reasonable and
      undeclared will be refused often enough that the message must say why.

**Accept:** the matrix test is exhaustive; the architecture test fails if a
runtime call site is added without a decision.

**Risk:** high if started late. Do not let execution code land before this phase.

---

## Phase 12 — Environments

The prepared, versioned image plus the temporary writable session layer.

- [ ] **12.1** An environment is a versioned, digest-pinned image plus a writable
      session layer. Reproducible: the same environment id yields the same
      starting state.
- [ ] **12.2** Images are allowlisted and digest-pinned. A tag is not an identity.
- [ ] **12.3** Least privilege: rootless podman, dropped capabilities,
      `no-new-privileges`, seccomp, read-only rootfs where possible, cgroup
      memory/CPU/PID caps, no host namespaces, no host mounts.
- [ ] **12.4** An environment definition from an experience never overrides a
      privilege limit. It can only narrow.
- [ ] **12.5** The session layer is temporary and destroyed with the session.

**Accept:** the same environment id starts byte-identical; a manifest cannot
express a host mount or added capability.

**Risk:** medium.

---

## Phase 13 — Sessions

- [ ] **13.1** A session is temporary, expires on a server-enforced TTL, and is
      **never published** (`ADR-0012`). No ingress route.
- [ ] **13.2** The server stores a session descriptor only: id, tenant, expiry,
      reconnection metadata. **No command text, no output** (`ADR-0019`).
- [ ] **13.3** Rate-limit and quota session start.
- [ ] **13.4** Concurrent sessions per tenant are bounded by an enforced limit.
- [ ] **13.5** A session descriptor never crosses tenants.

**Accept:** no ingress route exists for a session; the descriptor table contains
no command text; TTL expiry is enforced by the platform, not the client.

**Risk:** medium.

---

## Phase 14 — Runtime

- [ ] **14.1** Podman behind `IProcessRunner` with `ArgumentList`, **never** a
      shell and never an interpolated command string.
- [ ] **14.2** `CancellationToken` flows from the transport boundary to the podman
      call. Every external call has a timeout.
- [ ] **14.3** Output streams have backpressure and an idle timeout. No unbounded
      channel fed by an unbounded process.
- [ ] **14.4** Network egress is policy-controlled and deny-by-default.
- [ ] **14.5** Platform cleans up the session layer and the container. Cleanup
      runs even when the session is abandoned.
- [ ] **14.6** Integration tests against real podman, **skipped** when podman is
      unavailable — never faked.

**Accept:** cancellation reaches podman; a runaway process cannot exhaust memory;
an abandoned session is reaped.

**Risk:** high. This is where a missing cancellation token or timeout becomes an
outage.

---

## Phase 15 — Execution

- [ ] **15.1** A command is a list of arguments. No shell, no PTY, no TTY
      (`ADR-0013`).
- [ ] **15.2** An execution streams structured events: started, output chunk,
      exit, cancelled. Not a byte stream. No cursor, no scroll region.
- [ ] **15.3** An output chunk carries **exactly** what the program printed.
      Nothing is sampled, reformatted, completed, or inferred.
- [ ] **15.4** A transcript block records command, exit code, and output.
- [ ] **15.5** Every execution passes `PolicyEvaluator` first. Declared commands
      get a narrower evaluation, never a bypass.
- [ ] **15.6** Rate-limit command submission per session and per tenant.
- [ ] **15.7** Execution lifecycle events go through the durable outbox (`8.2`).

**Accept:** output is byte-faithful to the process; a denied command produces no
process at all; no PTY type appears anywhere in the codebase.

**Risk:** high. This is the untrusted-input-to-RCE path.

---

## Phase 16 — Documentation

- [ ] **16.1** MDX is parsed and **validated at publish time**, not rendered
      as-is at read time. A document that fails validation is never published.
- [ ] **16.2** An explicit component allow-list. An unknown component name is a
      validation error.
- [ ] **16.3** Creator `import`, `export`, expressions, `{/* */}` evaluation, and
      arbitrary JSX are **not supported**. There is no path from a document to
      `eval` (`ADR-0017`).
- [ ] **16.4** No remote image or script origin is reachable without a
      publish-time allow-list check on the exact origin.
- [ ] **16.5** Reading a document renders a validated document model. It does not
      compile anything.
- [ ] **16.6** Golden-file tests per fixture, including each rejected fixture's
      named reason.

**Accept:** a document with `{globalThis.fetch(...)}` fails publish with a named
reason; a document with an unknown component fails publish; no reader path
evaluates creator code.

**Risk:** high. This is remote code execution on our origin if it regresses.

---

## Phase 17 — Experiences

- [ ] **17.1** Publish an experience: validate against the experience schema,
      validate its documents, record the version.
- [ ] **17.2** A published experience is immutable. A change publishes a new
      version, so a reader always sees the version they started.
- [ ] **17.3** An experience names secrets; it never carries values. Values are
      encrypted at rest, redacted in every log and error, and never returned by
      any API.
- [ ] **17.4** Publishing is rate-limited and audited.
- [ ] **17.5** `lazarus.json` is accepted from agents and CI with identical
      validation. `lazarus.yaml` is the human authoring form. Neither is a
      second contract.

**Accept:** publishing an invalid experience fails with field-level errors; a
secret value never appears in a response, a log, or an error.

**Risk:** medium.

---

## Phase 18 — SignalR and reconnection

- [ ] **18.1** Typed hubs, tenant-scoped groups. One tenant's events never reach
      another tenant's subscription.
- [ ] **18.2** Reconnect resumes a session from its descriptor without a second
      session start.
- [ ] **18.3** The event stream is the transport for `ExecutionEvent`s. No
      separate polling path for the same data.
- [ ] **18.4** An idle connection is dropped and can be re-established.

**Accept:** a cross-tenant subscription test fails if group scoping is removed.

**Risk:** medium.

---

## Phase 19 — OpenAPI and client generation

- [ ] **19.1** OpenAPI is generated from the controllers, not hand-written, and is
      published.
- [ ] **19.2** `packages/api-client` is generated from the OpenAPI document.
- [ ] **19.3** Errors use RFC 9457 `ProblemDetails` through a single error
      middleware.
- [ ] **19.4** `packages/realtime` is generated from the typed hub contract.
- [ ] **19.5** No hand-written client beside a generated one.

**Accept:** drift between the API and the client fails `just check`.

**Risk:** low.

---

## Phase 20 — Web foundation

- [ ] **20.1** `apps/web` is composition only: routes, layouts, page
      composition, provider wiring. No business logic, no data access, no state
      machines, no validation, no hand-written API clients.
- [ ] **20.2** Tailwind wired to the generated token CSS variables. No raw colour
      utility anywhere (`ADR-0018`).
- [ ] **20.3** `packages/ui` holds design-system primitives and no raw colour
      values.
- [ ] **20.4** `packages/config` holds the shared eslint, tsconfig, prettier, and
      vitest configuration.
- [ ] **20.5** The reducer is bound to React with a thin `useReducer` binding
      plus storage and transport wiring that contain no product logic (`6.1`).

**Accept:** `pnpm lint` fails on a raw colour in a component; the reducer binding
contains no transition logic.

**Risk:** low.

---

## Phase 21 — Web features

- [ ] **21.1** Documentation reading view with allow-listed components.
- [ ] **21.2** Command draft with suggestions, actions, and hover explanation.
- [ ] **21.3** Transcript rendering that consumes `TranscriptBlock`s and nothing
      else. It never parses output.
- [ ] **21.4** Rich output rendering escapes. ANSI is colour and control
      filtering, never `innerHTML`.
- [ ] **21.5** Transcript history in IndexedDB, cleared by clearing site data
      (`ADR-0019`).
- [ ] **21.6** Playwright coverage of the critical journey: read → compose →
      execute → read result.

**Accept:** a component never reads raw output; a blocked command renders an
explanatory denial.

**Risk:** medium.

---

## Phase 22 — CLI

- [ ] **22.1** Go 1.26 `lazarus` command: validate and publish an experience, list
      experiences, start and observe a session.
- [ ] **22.2** The CLI calls the API. It never re-implements policy, tenancy, or
      validation.
- [ ] **22.3** `execFile` with an argument list. No shell, no interpolated
      command strings.
- [ ] **22.4** `lazarus validate` and `lazarus publish` accept both
      `lazarus.yaml` and `lazarus.json`.

**Accept:** `go vet`, `go test ./...`, and `gofmt -l` are clean; a command the
server denies is denied identically through the CLI.

**Risk:** low.

---

## Phase 23 — Desktop (Tauri)

- [ ] **23.1** `apps/desktop` is shell wiring and window lifecycle only. It holds
      no interaction logic.
- [ ] **23.2** It consumes `@lazarus/interaction` exactly as `apps/web` does. The
      same transitions, the same tests, no fork.
- [ ] **23.3** A runtime port executes locally; the control plane executes
      remotely. Both satisfy the same port, chosen per deployment.
- [ ] **23.4** No PTY, no `node-pty`, no `xterm.js` in the shell either
      (`ADR-0013`).

**Accept:** a transition test suite runs against the desktop client's binding
without modification. If this needs a change, `packages/interaction` was wrong.

**Risk:** low. This phase is the acceptance test for `ADR-0014`.

---

## Phase 24 — Hardening and operations

- [ ] **24.1** One-command install is tested. `infra/compose/` is the reference.
- [ ] **24.2** Every external dependency is optional by default. OTel, Sentry, and
      exporters degrade to no-ops.
- [ ] **24.3** Rate limits and quotas on every write path, verified by test.
- [ ] **24.4** Audit trail complete for every privilege-affecting action.
- [ ] **24.5** `just check` green across every language, and it is the CI gate.
- [ ] **24.6** Secrets scan on every push, working tree and full history.
- [ ] **24.7** `SECURITY.md` and `docs/threat-model.md` current with the shipped
      behaviour.

**Accept:** a clean checkout reaches a running stack with one command; every
export is optional; `just check` is the only gate.

**Risk:** medium.

---

## Phase 25 — Release

- [ ] **25.1** `lazarus publish`, `lazarus run`, and `lazarus validate` work end
      to end against a real podman.
- [ ] **25.2** A published experience is readable and executable in the web app
      and from the CLI.
- [ ] **25.3** Every `AGENTS.md` §13 definition-of-done item holds.
- [ ] **25.4** `CHANGELOG.md` records the product change from the delivery
      platform to the interactive experience, as a breaking change.

**Accept:** a user follows the documentation, runs a real command, and reads real
output. Nothing in the transcript is simulated.

**Risk:** low.

---

## Phase dependencies at a glance

```
0  Security ──► 1  Foundation ──► 2  Contracts ──► 3  Codegen
                                                      │
                        4  Tokens ──► 5  Boundaries   │
                                       │              │
                                       └──► 6  Interaction core
                                                      │
0 ─► 7  .NET skeleton ──► 8  EventBus ──► 9  Auth ──► 10  Tenancy ──► 11  Policy
                                                                      │
                                        ┌─────────────────────────────┤
                                        ▼                             ▼
                                  12  Environments ──► 13  Sessions ──► 14  Runtime
                                        │                             │
                                        └──────────► 15  Execution ◄────┘
                                                     │
                                        16  Docs ──► 17  Experiences ──┤
                                                                     ▼
                                                       18  SignalR ──► 19  OpenAPI
                                                                     │
                              20  Web foundation ──► 21  Web features ─┤
                                                                     │
                                                   22  CLI ──► 23  Desktop
                                                                     │
                                                       24  Hardening ──► 25  Release
```

**Critical path:** `0 → 1 → 2 → 3 → 7 → 8 → 9 → 10 → 11 → 12 → 14 → 15`.

**Phase 11 (Policy) blocks 12, 14, and 15.** Do not let container or exec code
land before it. This is the one ordering that is a security property rather than a
convenience.

**Phase 6 (interaction core) blocks 20, 21, and 23.** Every client consumes it, so
building a client first means building it twice.

---

## Explicitly not planned

Recorded so these do not creep in. Each would need its own ADR.

### Deleted product lines

These were built, then removed on 2026-10-04. They are listed because a reader of
the old history will meet them, and because reinstating any of them is a decision,
not a task.

- Spec-driven builds, image builds, and deployments
- Subdomain-per-deployment routing and wildcard ACME for user workloads
- A CI pipeline — checkout, build, test, scan, deploy
- Publishing a session's ports, or any ingress route for a user container
- Interactive programs: `vim`, `top`, an interactive `psql`, anything wanting a TTY

### Never planned

- Multi-region deployment or cross-region failover
- A Kubernetes backend as an alternative to podman
- A general-purpose secrets vault competing with 1Password/Vault
- Collaborative or real-time editing of any kind
- Server-side transcript storage (`ADR-0019` reverses any earlier attempt)
- A visual editor of any kind — canvas, node graph, or form builder beyond the
  schema-driven publish form
- Billing or payment processing
