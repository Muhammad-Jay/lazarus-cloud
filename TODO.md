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

- [ ] **0.1** Revoke the GitHub classic personal access token committed at
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
- [ ] **0.2** Rotate the Supabase anon key exposed in `front-end/.env.local`.
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

## Phase 2 — The spec contract

The contract every other phase obeys. Nothing user-facing starts before this.

- [ ] **2.1** Write `packages/spec/lazarus.schema.json`: JSON Schema 2020-12,
      `$id` addressable, `apiVersion` discriminated on major version.
- [ ] **2.2** Model the surface: `Service`, `source` (git/inline/upload),
      `build`, `runtime` (image, ports, env, limits, health), `exposure`,
      `pipeline`, `secrets` (by reference only).
- [ ] **2.3** **Omit** any field for privileged mode, host mounts, host
      networking, added capabilities, or host namespaces. They must be
      inexpressible (`AGENTS.md` §4.5).
- [ ] **2.4** Generate TypeScript types and a validator (Ajv) into
      `packages/spec`. Types are generated, never hand-written.
- [ ] **2.5** Codegen tool in `tools/codegen`: schema → C# types and → Go types.
- [ ] **2.6** Golden-file fixtures: valid specs, each invalid case, and a
      spec using every optional field.
- [ ] **2.7** `docs/spec-reference.md` documenting each field.
- [ ] **2.8** `contract-drift` CI: regenerate all three languages and fail on any
      diff against committed output.

**Accept:** `just codegen` is idempotent; a deliberately broken spec fails
validation with a precise, actionable message; a hand-edit to a generated file
fails CI.

**Risk:** medium. Everything downstream codegen depends on this. Getting the
schema wrong is expensive to change later — additive changes are cheap, removals
are breaking and require a new `apiVersion`.

---

## Phase 3 — .NET control plane skeleton

- [ ] **3.1** `apps/control-plane/Lazarus.sln` with
      `Directory.Build.props` and central package management
      (`Directory.Packages.props`).
- [ ] **3.2** `Lazarus.Domain`: `Entity`, `AggregateRoot`, `ValueObject`,
      `DomainEvent`, `IDomainEvent`, `TenantId`, `Result<T>`, `Error`, `IClock`.
      References nothing.
- [ ] **3.3** `Lazarus.Application`: `ICommandHandler<,>`,
      `IQueryHandler<,>`, `IUnitOfWork`, `IDomainEventDispatcher`,
      `IPodmanClient`, `ICurrentUser`, `IPolicyEvaluator`, cross-module DTOs.
- [ ] **3.4** `Lazarus.Infrastructure`: `LazarusDbContext`, Postgres via Npgsql,
      migrations, tenancy resolution, OTel, Serilog.
- [ ] **3.5** `Lazarus.EventBus` and `Lazarus.Api` skeleton: DI composition root,
      health checks (`/health/live`, `/health/ready`), ProblemDetails middleware,
      exception handler.
- [ ] **3.6** Module template: a `ModuleTemplate` showing the expected
      `Domain`/`Application`/`Api` layout, and the first real module
      (`Tenancy`) built from it.
- [ ] **3.7** Typed options classes validated at startup. No string-typed
      config lookups.
- [ ] **3.8** `Lazarus.Architecture.Tests` (NetArchTest) enforcing §4.1 and §4.2.
- [ ] **3.9** CI: build, format check, test, analyzers.

**Accept:** `just cp-build && just cp-test` green; the architecture test fails if
a module is given a sibling reference; `/health/ready` returns 200 against
Testcontainers Postgres.

**Risk:** low.

---

## Phase 4 — EventBus

- [ ] **4.1** `IDomainEventHandler<TEvent>` and a DI-registered dispatcher.
- [ ] **4.2** Bounded `Channel<object>` + `BackgroundService` pump, per-event-type
      handler resolution, parallel fan-out.
- [ ] **4.3** Publish from an EF `SaveChangesInterceptor`, **after** commit.
- [ ] **4.4** Error isolation: one handler's failure must not stop the pump or
      block other handlers. Structured log + OTel event.
- [ ] **4.5** Backpressure policy and graceful shutdown draining.
- [ ] **4.6** Tests: dispatch, isolation, duplicate-delivery idempotency,
      shutdown drain.
- [ ] **4.7** Record the durability tradeoff in `ADR-0003`, including the outbox
      option if a transition must not be lost.

**Accept:** a handler that throws does not prevent a sibling handler from
running; no event is dispatched before the transaction commits.

**Risk:** medium. In-memory means at-most-once. Documented, not hidden.

---

## Phase 5 — Auth service

- [ ] **5.1** `services/auth`: Better Auth standalone, owning the `auth` Postgres
      schema via the Kysely adapter.
- [ ] **5.2** `organization` plugin. The JWT's organization claim is the
      `tenant_id` for all Lazarus resources — one identity source, no duplicated
      user table.
- [ ] **5.3** JWT plugin with **ES256** (not the EdDSA default) so
      `Microsoft.AspNetCore.Authentication.JwtBearer` validates it without
      special configuration.
- [ ] **5.4** JWKS served at the auth service's `/.well-known/jwks.json`, proxied
      from Better Auth's native `/api/auth/jwks` by `services/auth` itself, so the
      well-known path is a stable contract (see `ADR-0004`).
- [ ] **5.5** Scoped **API keys** for the Automation API and the CLI, distinct
      from user sessions, hash-stored.
- [ ] **5.6** `.NET` integration test proving a token issued by this service
      validates in `apps/control-plane`. This test is the contract.
- [ ] **5.7** Device-authorization flow for the Go CLI; tokens stored in the OS
      keyring.
- [ ] **5.8** Verify secret rotation works with `sessionCookieCache`. **This needs
      its own ADR** — session cache invalidation is unrelated to `ADR-0003`, which
      covers in-memory domain events.

**Accept:** `5.6` passes; `jwks` returns RFC 7517; a revoked session cannot mint
a token; an API key cannot escalate to an admin scope.

**Risk:** medium. This is the trust root for the entire system. If ES256 does not
validate cleanly in .NET, resolve it here, not later.

---

## Phase 6 — Tenancy and identity

- [ ] **6.1** `tenant_id` on **every** tenant-scoped table. No exceptions.
- [ ] **6.2** Postgres **row-level security** policies per table, as
      defence-in-depth behind the application filter.
- [ ] **6.3** `ICurrentUser` resolved from the validated token only. Never from a
      header the client sets freely, a body, a query parameter, or a URL segment.
- [ ] **6.4** Authorization policies: `Tenant`, `TenantAdmin`, `AutomationClient`.
- [ ] **6.5** `Identity` module: user projection, API keys, service accounts.
- [ ] **6.6** `Tenancy` module: tenant profile, quota, policy profile, base
      domain (**install-time config**, never hardcoded), DNS verification status.
- [ ] **6.7** Integration tests: cross-tenant read returns nothing; cross-tenant
      write is rejected; RLS holds even with a bug in the query filter.

**Accept:** `6.7` proves isolation twice over. A tenant cannot name another
tenant in any request and reach its data.

**Risk:** high. Tenant isolation is the single defect class that loses the
product's credibility. Build the negative tests before the happy path.

---

## Phase 7 — Policy — the security chokepoint

**Must land before any container code exists.** Runtime and Exec cannot be
written safely without it.

- [ ] **7.1** `PolicyEvaluator` returning a decision: `Allow`, `Deny(reason)`,
      or `Constrain(modifications)`. Policy only ever subtracts.
- [ ] **7.2** Image policy: allowlisted registries and base images. Tag resolved
      to a **digest**; a tag is not an identity.
- [ ] **7.3** Resource policy: memory, CPU, PIDs, disk. Unbounded → deny.
- [ ] **7.4** Network policy: egress allowlist per tenant. Default deny.
- [ ] **7.5** Command policy: which images permit shell/exec, and whether a
      tenant may spawn ad-hoc containers.
- [ ] **7.6** Concurrency and rate policy: per-tenant concurrent deployments,
      concurrent exec sessions, requests per minute.
- [ ] **7.7** Table-driven test over the **full** decision matrix, including
      every deny path.
- [ ] **7.8** Architecture test proving no `Runtime` or `Exec` entry point is
      reachable without a policy decision, and that `PolicyEvaluator` has no
      method which can grant capability.
- [ ] **7.9** Audit record for every decision: actor, tenant, target, decision,
      reason, timestamp.

**Accept:** `7.8` is green and cannot be bypassed; an unknown image is denied; a
spec requesting privileged mode fails validation *and* is denied if it somehow
arrives.

**Risk:** high, and deliberately early. Everything downstream inherits this.

---

## Phase 8 — Runtime

- [ ] **8.1** `IPodmanClient` over the podman **REST API socket**, or
      `ProcessStartInfo` with `ArgumentList`. Never a shell string. Never
      interpolated.
- [ ] **8.2** Build with build context isolation; never upload host secrets or
      `node_modules` equivalents by accident.
- [ ] **8.3** Pull with digest pinning; record the resulting digest on the release.
- [ ] **8.4** Sandbox enforcement: rootless, `--cap-drop=all`,
      `--security-opt=no-new-privileges`, seccomp, read-only rootfs where
      possible, cgroup memory/CPU/PID caps, no host namespaces, no host mounts,
      no `docker.sock`.
- [ ] **8.5** Container lifecycle: create, start, stop, remove; idempotent.
- [ ] **8.6** One pod per service, so an app's containers share a network.
- [ ] **8.7** **Dynamic host-port allocation** with collision avoidance and
      release on teardown.
- [ ] **8.8** Log streaming with backpressure, an idle timeout, and a bounded
      buffer.
- [ ] **8.9** Every call carries a `CancellationToken` and a timeout.
- [ ] **8.10** Integration tests against real podman, skipped when unavailable.

**Accept:** `8.4` holds under inspection — no privileged flag, no host path, no
added capability reaches the container; `8.7` never double-binds under
concurrent deploys.

**Risk:** high. This is the sandbox boundary. Assume anything that reaches podman
is attacker-controlled.

---

## Phase 9 — Delivery core

- [ ] **9.1** `Specs` module: spec version storage, provenance (repo commit /
      dashboard edit / API call), validation results.
- [ ] **9.2** `Services` module: service aggregate, slug (subdomain label,
      collision-checked), links to release and endpoints.
- [ ] **9.3** `Releases` module: immutable artifact from a spec — built or pulled
      image digest, resolved config, provenance.
- [ ] **9.4** `Deployments` module: the state machine
      `Queued → Building → Starting → Healthy → (Failed | Stopped)`, with
      rollback to the previous healthy release.
- [ ] **9.5** State transitions are guarded; illegal transitions are rejected, not
      ignored.
- [ ] **9.6** Health checks per the spec's `runtime.health`, driving the
      `Healthy` transition.
- [ ] **9.7** Deployment is **idempotent** for a given
      `(service, release)` pair — no duplicate containers on retry.
- [ ] **9.8** Cancellation and timeout on every state transition.
- [ ] **9.9** Domain events: `DeploymentStarted`, `DeploymentBecameHealthy`,
      `DeploymentFailed`, `ImageBuilt`, `ReleaseCreated`.

**Accept:** the full matrix of illegal transitions is tested; a retried deploy
does not create a second container; a failed health check triggers rollback
without human intervention.

**Risk:** high.

---

## Phase 10 — Endpoints and edge routing

- [ ] **10.1** `Endpoints` module: exposed port, subdomain, TLS status, routing
      intent, health.
- [ ] **10.2** Subdomain allocation with collision handling and reserved words
      (`www`, `api`, `admin`, `mail`).
- [ ] **10.3** Caddy configuration rendered from the endpoint set.
- [ ] **10.4** Wildcard ACME when the install owns a domain.
- [ ] **10.5** **Self-hosted without a domain**: self-signed CA + LAN hostname,
      and a documented `--insecure` dev path. No code path assumes a real cert.
- [ ] **10.6** Hot reload on endpoint change, with the previous config retained
      until the new one validates.
- [ ] **10.7** Route to the container's allocated host port.
- [ ] **10.8** Tests: config rendering is deterministic; a malformed config never
      replaces a working one.

**Accept:** `docker compose up` on a LAN-only host yields reachable HTTPS
endpoints without any external dependency; a wildcard-domain install obtains a
valid cert.

**Risk:** medium.

---

## Phase 11 — Exec and the web terminal

- [ ] **11.1** `Exec` module: session aggregate with lifecycle
      `Requested → Attaching → Active → Closed`, tenant-scoped.
- [ ] **11.2** PTY allocation inside the container via podman exec.
- [ ] **11.3** One shared exec pipeline serves both the interactive terminal and
      the CI step runner. One code path, not two.
- [ ] **11.4** Streaming over SignalR to a group scoped to the session.
- [ ] **11.5** **Policy-gated**: shell access requires an image policy grant;
      ad-hoc container spawn may be disabled per tenant.
- [ ] **11.6** Idle timeout, absolute session limit, concurrent-session cap.
- [ ] **11.7** Full audit: who opened which session in which container, when, and
      the commands issued.
- [ ] **11.8** Reconnection: a dropped stream resumes, or the session is closed
      cleanly. Never an orphaned container from a lost connection.

**Accept:** every exec is policy-checked and audited; a closed browser leaves no
running container; concurrent sessions hit the cap.

**Risk:** high. A remote shell is the most privileged surface in the product.

---

## Phase 12 — Sources (GitHub)

- [ ] **12.1** GitHub App: manifest, registration flow, private key handling.
- [ ] **12.2** Installations and repository links.
- [ ] **12.3** Repository clone/fetch using installation credentials, held as
      sealed secrets.
- [ ] **12.4** Webhook receiver with **signature verification** on every request.
- [ ] **12.5** Commit status checks posted back to GitHub.
- [ ] **12.6** Rate-limit and retry handling against GitHub's API, with backoff.
- [ ] **12.7** `Sources` module entities and events.

**Accept:** an unsigned webhook is rejected; a revoked installation stops
deployments cleanly; credentials never appear in a log.

**Risk:** medium.

---

## Phase 13 — Automation and CI

- [ ] **13.1** `Automation` module: the Automation API —
      `POST /v1/automations` accepting `{ spec, options }`, returning a deployment
      id immediately.
- [ ] **13.2** API-key auth, scope-checked, rate-limited, quota-bound.
- [ ] **13.3** Trigger sources: webhook, manual, API. One pipeline definition.
- [ ] **13.4** Stages from the spec's `pipeline`: `checkout, build, test, scan,
      deploy`.
- [ ] **13.5** Job and step state machine, persisted, resumable.
- [ ] **13.6** Per-step logs streamed over SignalR and retained.
- [ ] **13.7** Failure stops the pipeline; deploy failure rolls back.
- [ ] **13.8** Concurrency limits: one pipeline per service, cancellable.

**Accept:** an AI agent can POST a spec and receive a deployment id plus a log
stream with no further interaction; a failing test blocks the deploy; a duplicate
trigger does not start a second pipeline.

**Risk:** high. This is the untrusted-input-to-RCE surface. `7.x` must be solid.

---

## Phase 14 — Secrets

- [ ] **14.1** `Secrets` module: per-tenant namespaced secret metadata.
- [ ] **14.2** Envelope encryption at rest; master key from environment, never
      from the database.
- [ ] **14.3** Values **never returned** by any API — write-only, redacted
      everywhere.
- [ ] **14.4** Specs reference secrets **by name only**.
- [ ] **14.5** Injection at container create time via environment, never baked
      into an image layer.
- [ ] **14.6** Rotation without redeploy where the container supports it.
- [ ] **14.7** Audit on read, write, and delete.

**Accept:** a secret value cannot be retrieved through any endpoint, including
admin endpoints; no secret appears in a build log or an error message.

**Risk:** medium.

---

## Phase 15 — SignalR and shared contracts

- [ ] **15.1** Typed hubs per module (`DeploymentsHub`, `LogsHub`, `ExecHub`,
      `PipelineHub`), declared in the module's `Api` project.
- [ ] **15.2** **Tenant-scoped groups**: `t:{tenantId}`, `s:{serviceId}`,
      `d:{deploymentId}`, `x:{sessionId}`. Every `SendAsync` is group-scoped.
- [ ] **15.3** Every hub method derives tenant and actor from the connection's
      claims, never from its payload.
- [ ] **15.4** Hub manifest emitted to `packages/contracts/hub-manifest.json`:
      hub name, method names, DTO shapes.
- [ ] **15.5** TypeScript declarations in `packages/realtime` checked against
      that manifest by CI.
- [ ] **15.6** Backpressure on outbound sends; a slow client cannot exhaust memory.
- [ ] **15.7** `WebApplicationFactory` tests proving one tenant never receives
      another's events.

**Accept:** `15.7` is green — no cross-tenant event delivery is possible; a
method renamed on the C# side fails CI until the TS side is updated.

**Risk:** medium.

---

## Phase 16 — OpenAPI and client generation

- [ ] **16.1** OpenAPI document emitted from the ASP.NET host.
- [ ] **16.2** `tools/codegen` generates a typed TypeScript client into
      `packages/api-client`.
- [ ] **16.3** Generated error handling normalises `ProblemDetails` into one
      typed app-level error.
- [ ] **16.4** `contract-drift` CI fails when the committed client differs from a
      fresh generation.
- [ ] **16.5** No hand-written `fetch` calls remain in `packages/`.

**Accept:** regeneration is idempotent; drift fails CI; a new endpoint requires no
manual client work in the web app.

**Risk:** low.

---

## Phase 17 — Front-end foundation

- [ ] **17.1** `apps/web` on Next.js 16.3.8 (Active LTS) with React 19.3,
      App Router, Turbopack.
- [ ] **17.2** `strict: true`. No `ignoreBuildErrors`, no `ignoreDuringBuilds`.
- [ ] **17.3** ESLint 9 flat config with `typescript-eslint` 8; Prettier for
      formatting. `eslint-disable` is not permitted (see banned list).
- [ ] **17.4** Vitest + Testing Library; Playwright for critical journeys.
- [ ] **17.5** `knip` in CI to fail on unused exports, files, and dependencies.
- [ ] **17.6** Workspace packages created: `ui`, `api-client`, `realtime`,
      `auth-client`, `lib-utils`, `testing`, `config`.
- [ ] **17.7** One logger wrapper per package; no `console.*` in `packages/`.
- [ ] **17.8** Server Components by default; client components only where
      interactivity requires them.
- [ ] **17.9** Env vars validated with a typed schema at startup; `.env.example`
      committed.

**Accept:** `just web-typecheck` and `just web-lint` are clean with zero
suppressions; `knip` reports nothing.

**Risk:** medium.

---

## Phase 18 — Front-end features

Each slice moves logic out of `apps/web` into `packages/feature-*` and lands with
tests. Do not batch slices.

- [ ] **18.1** Auth: Better Auth client, session handling, protected route group,
      real middleware guard (server-side, not client-side).
- [ ] **18.2** Dashboard: services, recent deployments, quota usage.
- [ ] **18.3** Service detail: releases, deployments, endpoints, config.
- [ ] **18.4** Deployment detail: live logs over SignalR, health, actions
      (restart, stop, rollback, redeploy).
- [ ] **18.5** **Instant container**: launch and get a terminal.
- [ ] **18.6** **Web terminal**: xterm.js, resize, reconnect, session indicator.
- [ ] **18.7** Endpoints: expose a port, subdomain, TLS status.
- [ ] **18.8** Pipelines: run list, run detail with per-step logs.
- [ ] **18.9** Repositories: GitHub App connection, installation, repo linking.
- [ ] **18.10** **Spec editor**: YAML/JSON editor + form, both validating against
      `packages/spec` with inline diagnostics.
- [ ] **18.11** Settings: domain, TLS, secrets, API keys, policy profile, quota.
- [ ] **18.12** API docs page for the Automation API.

**Accept:** no business logic remains in `apps/web`; each slice has component
tests and its critical path has a Playwright test.

**Risk:** medium-high by volume. Sequence matters — `18.5` and `18.6` depend on
Phase 11; `18.10` depends on Phase 2.

---

## Phase 19 — Go CLI

- [ ] **19.1** `apps/cli` with cobra + viper; binary `lazarus`.
- [ ] **19.2** `lazarus.yaml` discovery and merge, with a validated model
      generated from the Phase 2 schema.
- [ ] **19.3** `auth login` — device flow; token in the OS keyring.
- [ ] **19.4** `spec validate` — validates locally against the embedded schema.
- [ ] **19.5** `up` — launch an instant container and attach a terminal.
- [ ] **19.6** `deploy` — submit a spec, stream the deployment.
- [ ] **19.7** `logs` — follow, filter, tail.
- [ ] **19.8** `exec` — run one command in a running container.
- [ ] **19.9** `ports` / `expose` — manage public endpoints.
- [ ] **19.10** `ci watch` — follow a pipeline run.
- [ ] **19.11** `.lazarusignore` with gitignore semantics: directory-level
      pruning, binary detection, no unbounded reads.
- [ ] **19.12** Source upload: gzipped tar over HTTP, chunked, size-limited. Not
      socket frames.
- [ ] **19.13** `config migrate` — convert a legacy config to `lazarus.yaml`.
- [ ] **19.14** Errors wrap with `%w`; no bare `fmt.Println` outside UI helpers.

**Accept:** `lazarus up` reaches a shell from a clean machine with one command;
a large repo uploads without exhausting memory; `spec validate` catches the same
errors as the server.

**Risk:** low.

---

## Phase 20 — Infrastructure

- [ ] **20.1** `infra/compose/`: the reference one-command install — Postgres,
      auth, control-plane, Caddy. The reference implementation of the
      self-hostable constraint (`AGENTS.md` §1).
- [ ] **20.2** Rootless podman socket exposed to the control-plane only.
- [ ] **20.3** Dockerfiles: `apps/web`, `apps/control-plane`. Non-root,
      multi-stage, minimal.
- [ ] **20.4** Wildcard TLS via Caddy, plus the self-signed LAN fallback.
- [ ] **20.5** `.devcontainer` reproducing the full stack.
- [ ] **20.6** **The install is tested**: a CI job brings up the compose stack and
      asserts a service is reachable over HTTPS. One-command install is an
      acceptance criterion, not a claim.
- [ ] **20.7** Volume layout, backup and restore for Postgres and uploaded
      sources.
- [ ] **20.8** Log rotation and disk-pressure policy.

**Accept:** on a clean host, one documented command yields a working, HTTPS-
reachable Lazarus with no external dependency.

**Risk:** medium. This is the first-run experience for every self-hoster.

---

## Phase 21 — Hardening and operations

- [ ] **21.1** Rate limiting on every write path, especially the Automation API.
- [ ] **21.2** Audit log: durable, queryable, tamper-evident, retention policy.
- [ ] **21.3** Security headers, CORS policy, CSRF policy on cookie auth.
- [ ] **21.4** Quota enforcement at the database, not just in memory.
- [ ] **21.5** Secret scanning in CI (gitleaks or equivalent).
- [ ] **21.6** Dependency scanning; `contract-drift` and `knip` wired into required
      checks.
- [ ] **21.7** Container-escape tests: assert the sandbox holds against known
      techniques.
- [ ] **21.8** Chaos: kill the control-plane mid-deploy and assert the state
      machine recovers to a consistent state.
- [ ] **21.9** Runbooks: failed deploy, stuck container, leaked subdomain, TLS
      failure, compromised API key, restore from backup.
- [ ] **21.10** `docs/threat-model.md` reviewed and updated.

**Accept:** `21.8` recovers without manual intervention; every runbook is
followable end to end by someone who did not write it.

**Risk:** medium.

---

## Phase 22 — Release

- [ ] **22.1** Semantic versioning with a documented policy, including the
      `apiVersion` coupling for breaking spec changes.
- [ ] **22.2** `CHANGELOG.md` maintained per release, generated from conventional
      commits.
- [ ] **22.3** Release workflow: tag, build, sign, publish images, publish the
      CLI binary.
- [ ] **22.4** Upgrade path documented for self-hosted operators, including
      database migrations across versions.
- [ ] **22.5** Deprecation policy for API endpoints and spec versions.
- [ ] **22.6** Verify `docs/architecture.md`, `README.md`, and `SECURITY.md`
      match the shipped system.

**Accept:** a self-hoster can go from `v1.0.0` to `v1.1.0` following the
documented path with no manual database work.

**Risk:** low.

---

## Phase dependencies at a glance

```
0  Security ──► 1  Foundation ──► 2  Spec contract ──┬─► 17  Web foundation ──► 18  Web features
                                                    │
                        3  .NET skeleton ──► 4  EventBus ──► 5  Auth ──► 6  Tenancy
                                                                      │
                                                            7  Policy ◄┘ (blocks 8, 11, 13)
                                                                      │
                                              8  Runtime ──► 9  Delivery ──► 10  Edge
                                                              │
                                              11  Exec ───────┤
                                              12  Sources ────┤
                                              13  Automation ─┤
                                              14  Secrets ────┘
                                                              │
                                              15  SignalR ──► 16  OpenAPI ──┐
                                                                             │
                                                              19  CLI ────────┤
                                                                             │
                                                    20  Infra ──► 21  Hardening ──► 22  Release
```

**Critical path:** `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 13`.

Phase 7 (Policy) blocks 8 (Runtime), 11 (Exec), and 13 (Automation). Do not let
container code land before it.

---

## Explicitly not planned

Recorded so these do not creep in. Each would need its own ADR.

- Multi-region deployment or cross-region failover
- A Kubernetes backend as an alternative to podman
- A public template gallery or marketplace
- A general-purpose secrets vault competing with 1Password/Vault
- Collaborative or real-time editing of any kind
- A visual editor of any kind — canvas, node graph, or form builder beyond the
  schema-driven spec form
- Billing or payment processing