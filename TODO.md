# TODO

This is the working plan for Lazarus. It follows [`AGENTS.md`](./AGENTS.md),
[`README.md`](./README.md), and [`LAZARUS_MODEL.md`](./LAZARUS_MODEL.md), with
`AGENTS.md` treated as the boundary authority for architecture and safety.

Lazarus is an interactive documentation and software execution platform. A creator
publishes an experience; a user reads documentation, composes real commands, runs
them in a real isolated environment, and inspects real output in the same
transcript. The plan below keeps that product shape intact: no PTY, no terminal
emulator, no IDE, no CI pipeline, no graph editor, no fabricated output.

---

## Planning Rules

- Work from the contract inward: schema, generated types, interaction model,
  transport, then UI composition.
- `apps/web` stays composition-only. Product logic belongs in `packages/*`.
- Every container, exec, image, filesystem, and network operation goes through a
  `PolicyEvaluator` decision.
- Generated code is regenerated from schemas. Generated outputs are never the
  source of truth.
- Self-hosting is an acceptance criterion: one person, one machine, one command,
  no mandatory hosted control plane.
- Mock execution is allowed only for the prototype fixture and must not be
  reachable from a production execution path.

---

## Current State

| Area | Status |
|---|---|
| Experience contract, `packages/spec` | Built and tested. |
| Interaction/session contracts, `packages/contracts` | Built and tested for TypeScript. C# and Go generation still missing. |
| Code generation | TypeScript schema and token generation exist. Multi-language targets are next. |
| Interaction core, `packages/interaction` | Built: reducer, transcript normalization, ranking, ANSI filtering, id derivation. |
| Tokens, `packages/tokens` | Built: semantic token JSON, generated CSS/TS, ColorRole alignment. |
| Web app, `apps/web` | Minimal Next app scaffold exists and consumes tokens + interaction. Real product UI not built. |
| Control plane, `apps/control-plane` | README/planned architecture only. No .NET solution yet. |
| Auth service, `services/auth` | README/planned architecture only. No Better Auth service yet. |
| CLI, `apps/cli` | Go build-wiring stub only. |
| Infra | README/planned self-hosting shape only. Compose stack not implemented. |
| Docs | Product and boundary docs exist; several package/app READMEs still reflect older phase names or old product wording. |

Recent completed work:

- [x] Interaction model implemented once in `@lazarus/interaction`.
- [x] Structured interaction/session contracts added with schema tests.
- [x] Semantic tokens created and generated.
- [x] Minimal web scaffold added.
- [x] Next dev resolution fixed for workspace packages using NodeNext `.js` imports.

---

## Next Phase 0 — Repo Plan And Documentation Alignment

The repository now has enough foundation that stale docs are becoming dangerous.
Clean the plan and docs before adding more product surface.

- [x] **0.1** Rewrite this TODO around the current Lazarus product and repo state.
- [x] **0.2** Update `apps/web/README.md` to remove the old dashboard, CI, endpoint,
      and web-terminal plan. Replace it with the interactive documentation
      workspace responsibilities.
- [x] **0.3** Update `apps/control-plane/README.md`, `apps/cli/README.md`,
      `services/auth/README.md`, and `infra/README.md` so they match
      `AGENTS.md` and the current phase ordering.
- [x] **0.4** Reconcile README version drift: the docs say Next.js 16/.NET 10/Go
      1.26, while the current implementation uses Next.js 15 and local tooling may
      run older Node. Decided to correct docs to match current implementation
      (Next.js 15.5.3 in web; .NET 10, Go 1.26, Node >=22 as per toolchain).
- [x] **0.5** Add a short `docs/architecture.md` or refresh the existing one so the
      architecture overview, package graph, self-hosting promise, and anti-goals
      are in one maintained document.
- [x] **0.6** Decide how built package outputs are handled. Either require local
      package builds before app builds, or keep source transpilation as the dev
      path and document why `dist/` remains ignored. (Decision: keep source
      transpilation in dev; `dist/` remains ignored to avoid committing build
      artifacts.)

Accept: `TODO.md`, root `README.md`, app/package READMEs, and architecture docs no
longer contradict the product shape or current implementation.

---

## Next Phase 1 — Tooling And Boundary Enforcement

The hard rules should fail locally before review. Several are described in docs but
not yet enforced across the whole repo.

- [ ] **1.1** Create shared package tooling in `packages/config`: TypeScript,
      Vitest, lint, and formatting presets used by every TS package.
- [ ] **1.2** Add lint rules/tests for frontend package boundaries: no package
      imports another package's `src/`, no phantom dependencies, no `feature-*` to
      `feature-*` imports.
- [ ] **1.3** Add raw visual value enforcement outside `packages/tokens`: no raw
      Tailwind colors, arbitrary color values, visual inline styles, `rgb()`,
      `hsl()`, or `oklch()` in UI code.
- [ ] **1.4** Make `just check` reliable with the current repo state. Fix missing
      scripts or stale package metadata rather than weakening checks.
- [ ] **1.5** Add contract drift coverage for generated TypeScript and docs, and
      extend the check when C# and Go generation land.
- [ ] **1.6** Add dependency hygiene checks for banned packages: `xterm.js`,
      `node-pty`, `@xterm/*`, `reactflow`, and `@xyflow/react`.
- [ ] **1.7** Ensure local build caches and generated package build outputs stay
      ignored unless a future ADR explicitly changes that.

Accept: boundary violations are caught by tests/lint, and `just check` is the honest
local gate described by `AGENTS.md`.

---

## Next Phase 2 — Contract Completion

The TypeScript contracts exist, but Lazarus is explicitly multi-client and
multi-language. Finish the contract loop before building transport-heavy features.

- [ ] **2.1** Define documentation metadata schema for documents, commands, tasks,
      references, hover content, and search indexing inputs.
- [ ] **2.2** Update `docs/experience-reference.md` and `docs/contracts-reference.md`
      for the documentation metadata shape.
- [ ] **2.3** Generate C# contract types under `apps/control-plane/src/Lazarus.Contracts`
      from the same JSON Schemas. Do not hand-edit generated output.
- [ ] **2.4** Generate Go contract/spec types for `apps/cli` from the same schemas.
- [ ] **2.5** Add golden tests proving YAML and JSON experience files are the same
      contract in two encodings.
- [ ] **2.6** Add negative schema fixtures for privileged runtime fields that must
      never be expressible: host networking, host mounts, docker socket,
      privileged mode, added capabilities, and host namespaces.
- [ ] **2.7** Add schema/docs drift checks for every generated target.

Accept: every contract change regenerates TS, C#, and Go targets plus references in
one workflow.

---

## Next Phase 3 — UI Foundations

Build the UI foundation as reusable packages before expanding `apps/web`.

- [ ] **3.1** Create `packages/ui` for design-system primitives using only semantic
      tokens from `@lazarus/tokens`.
- [ ] **3.2** Create `packages/lib-utils` for tiny shared helpers only when used by
      more than one package.
- [ ] **3.3** Create `packages/testing` for shared Vitest/Testing Library setup.
- [ ] **3.4** Replace visual inline styles in the web scaffold with token-backed UI
      primitives or scoped composition classes.
- [ ] **3.5** Add accessible primitives needed by the first workspace: button,
      icon button, input/editor shell, popover, menu, tabs, transcript block,
      command pill, search result, and notice.
- [ ] **3.6** Add responsive layout tests or Playwright screenshots for the main
      workspace once the first real screen exists.

Accept: `apps/web` composes primitives and feature packages; it does not own product
logic, styling tokens, or state machines.

---

## Next Phase 4 — Interactive Documentation Prototype

This is the first user-facing product validation. It uses mock execution fixtures
only to feed the real event contract.

- [ ] **4.1** Create a feature package for the workspace state and view composition
      consumed by `apps/web`.
- [ ] **4.2** Add a command editor based on CodeMirror or make an ADR-level decision
      if a different editor better satisfies the model. The editor must remain
      free-form text, not a form-only command builder.
- [ ] **4.3** Implement command draft history for browser-side sessions without
      putting history on the server.
- [ ] **4.4** Implement contextual command suggestions, subcommand discovery, and
      command pill insertion through `@lazarus/interaction` actions.
- [ ] **4.5** Implement documentation search over local fixture content.
- [ ] **4.6** Implement hover documentation and contextual popovers from declared
      documentation metadata.
- [ ] **4.7** Implement a structured transcript renderer that consumes
      `TranscriptBlock` and `RichOutput` only. Presentation must not parse raw
      process output itself.
- [ ] **4.8** Add a clearly marked mock execution adapter that emits real
      `ExecutionEvent` fixtures and is impossible to wire into production.
- [ ] **4.9** Add Playwright coverage for the prototype journey: read docs, search,
      insert command, execute fixture, inspect transcript, restore local session.

Accept: the first workspace demonstrates the model without a real runtime and
without introducing any product path that fabricates output.

---

## Next Phase 5 — MDX Publish-Time Validation

Creator content is untrusted. Documentation must be validated before it can become
interactive workspace content.

- [ ] **5.1** Define the allowed MDX component list for documentation, command refs,
      task refs, callouts, command pills, and structured output examples.
- [ ] **5.2** Build publish-time MDX parsing and validation. Reject imports, exports,
      arbitrary expressions, unknown components, and unsafe image/script origins.
- [ ] **5.3** Extract searchable concepts, command references, task references, and
      hover content from validated documents.
- [ ] **5.4** Connect extracted metadata to the documentation metadata schema from
      Phase 2.
- [ ] **5.5** Add fixtures proving unsafe creator content is rejected and safe
      content produces deterministic metadata.

Accept: no raw creator MDX is rendered at read time; the web app consumes validated
metadata and allowed content only.

---

## Next Phase 6 — Control Plane Foundation

Build the backend only after the interaction and content contracts are firm enough
to avoid speculative infrastructure.

- [ ] **6.1** Create the .NET solution with `Domain`, `Application`, `Contracts`,
      `Infrastructure`, `EventBus`, `Api`, and `Modules/*` layout from `AGENTS.md`.
- [ ] **6.2** Add shared kernel primitives only: `Entity`, `AggregateRoot`,
      `ValueObject`, `DomainEvent`, `IDomainEvent`, `TenantId`, `Result<T>`,
      `Error`, and `IClock`.
- [ ] **6.3** Add NetArchTest rules for layer direction, module isolation, no sibling
      module imports, controller thinness, and the policy chokepoint.
- [ ] **6.4** Add RFC 9457 `ProblemDetails` middleware and typed options validation.
- [ ] **6.5** Add EF/Postgres infrastructure only where needed for the first
      experience/session modules.
- [ ] **6.6** Add audit primitives for privileged decisions before adding privileged
      operations.

Accept: architecture tests fail on the forbidden dependencies before any runtime
adapter is introduced.

---

## Next Phase 7 — Auth Service And Tenant Trust

Identity is separate from the web app and validates locally through JWKS.

- [ ] **7.1** Create `services/auth` with Better Auth, Postgres, organizations, and
      ES256 JWT issuance.
- [ ] **7.2** Publish JWKS at the documented route and configure key rotation.
- [ ] **7.3** Add API key support for CLI and automation clients with scoped claims.
- [ ] **7.4** Add control-plane JWT validation against JWKS with no per-request auth
      service network hop.
- [ ] **7.5** Prove tenant scope comes only from the validated token, never request
      body, query string, or route params.
- [ ] **7.6** Add integration tests covering browser session, CLI bearer token, and
      API key validation.

Accept: every tenant-scoped backend read/write derives tenant id from validated
identity.

---

## Next Phase 8 — Policy And Runtime Evaluation

Do not pick runtime details by assumption. Evaluate, decide, then implement behind
policy.

- [ ] **8.1** Write an ADR evaluating rootless podman against the runtime threat
      model: non-root execution, digest-pinned images, cleanup, cgroups, network
      egress, filesystem isolation, cancellation, and streaming.
- [ ] **8.2** Define `PolicyEvaluator` inputs/outputs for image, session start,
      command exec, filesystem, and network decisions.
- [ ] **8.3** Add table-driven policy tests for deny-by-default behavior and every
      allowed capability.
- [ ] **8.4** Implement a runtime abstraction behind Application ports. No controller
      or module bypass may reach podman/container APIs directly.
- [ ] **8.5** Implement prepared image plus temporary writable session layer.
- [ ] **8.6** Implement command execution as discrete requests with structured
      events. No PTY and no terminal byte stream.
- [ ] **8.7** Implement cancellation, bounded concurrency, process timeouts,
      backpressure, idle timeout, and cleanup.
- [ ] **8.8** Audit every privileged action: actor, tenant, target, policy decision,
      and timestamp.

Accept: no container, image, exec, filesystem, or network operation can be reached
without a policy decision, and tests prove the chokepoint.

---

## Next Phase 9 — Real Execution Integration

Connect the prototype to one real prepared environment after policy and runtime
boundaries exist.

- [ ] **9.1** Build a small Git-focused experience fixture with docs, metadata,
      prepared environment, and policy limits.
- [ ] **9.2** Add session creation and expiration APIs.
- [ ] **9.3** Stream stdout/stderr/status as `ExecutionEvent`s into the interaction
      reducer.
- [ ] **9.4** Add reconnection and replay with idempotent transcript block ids.
- [ ] **9.5** Restore browser-side `LocalSession` without implying an expired runtime
      is still alive.
- [ ] **9.6** Add API/realtime client packages only once the server contracts exist.
- [ ] **9.7** Add end-to-end tests for session start, command submit, stream, cancel,
      expire, reconnect, and cleanup.

Accept: a user can run a real command in one isolated Git experience and see only
real program output represented through structured transcript blocks.

---

## Next Phase 10 — Creator Workflow

Creator tooling comes after the first real experience proves the contracts.

- [ ] **10.1** Validate `lazarus.yaml` and `lazarus.json` with identical semantics.
- [ ] **10.2** Add local spec validation to the CLI.
- [ ] **10.3** Add publish/build workflow for prepared images with digest pinning.
- [ ] **10.4** Add sample projects/data packaging with path containment checks.
- [ ] **10.5** Add versioning and migration rules for published experiences.
- [ ] **10.6** Add reference docs and examples for a minimal creator experience.

Accept: a creator can validate and publish one safe, versioned experience without
manual database or runtime setup.

---

## Next Phase 11 — Self-Hosted Install

The one-command install is part of the product, not ops polish.

- [ ] **11.1** Build `infra/compose/` for Postgres, auth, control plane, web, edge,
      and local runtime prerequisites.
- [ ] **11.2** Add `.env.example` with install-time domain, TLS, database, auth, and
      master-key configuration. No real secrets.
- [ ] **11.3** Add Caddy/edge templates for wildcard ACME and LAN/self-signed modes.
- [ ] **11.4** Add health checks and startup ordering that fail honestly.
- [ ] **11.5** Add backup/restore scripts for self-hosted state.
- [ ] **11.6** Add CI or local smoke test that brings up the compose stack and checks
      the UI/API over the configured TLS mode.

Accept: `just dev-up` is a tested reference install, and TLS degrades honestly when
there is no owned domain.

---

## Explicitly Not Doing

- No PTY, `xterm.js`, `node-pty`, or `@xterm/*`.
- No browser terminal emulator with documentation beside it.
- No graph, flow, or node editor.
- No CI pipeline product surface.
- No long-lived cloud IDE or public user container ingress.
- No server-side transcript history database beyond required TTL/session metadata.
- No fabricated, sampled, inferred, or prettified command output.
- No external hosted control plane required for self-hosting.
