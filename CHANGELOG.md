# Changelog

All notable changes to Lazarus are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

Nothing released yet.

### Added

- **The product is interactive documentation and software execution.** A creator
  publishes an *experience* — documentation, a prepared software environment, and
  the command knowledge needed to use it — and a user reads the documentation,
  composes real commands, executes them in a real isolated environment, and reads
  real results. `ls`, `curl`, `git`, and `grep` actually run: nothing is
  simulated and no output is ever fabricated.
- **The anti-goals, written down.** `AGENTS.md` §1 now names what Lazarus is
  not: a terminal emulator, a flow/node/graph editor, a CI provider, a platform
  that publishes user containers, a cloud IDE, a simulator of command output, a
  general-purpose orchestrator, and a collaborative document store. A change that
  reintroduces any of them is rejected regardless of how it is phrased.
- `docs/adr/0012`–`0019`, replacing the decisions the old product needed:
  sessions are not published (`0012`), commands are discrete executions with no
  PTY (`0013`), the interaction model is a framework-free core (`0014`), policy
  adjudicates every command (`0015`), three schemas are versioned
  independently (`0016`), creator content is untrusted (`0017`), semantic tokens
  are the only public visual surface (`0018`), and user history is
  browser-first (`0019`). `0006`, `0007`, and `0010` are **superseded rather
  than edited**: each opens with a banner pointing at its replacement.
- **The interaction model has exactly one implementation.**
  `packages/interaction` is framework-free and imports only
  `@lazarus/contracts`. State transitions are a pure reducer, transcript
  normalisation happens once — where an `ExecutionEvent` becomes a
  `TranscriptBlock` — and suggestion ranking, draft-conflict resolution, and
  block ordering live there too. The web app, the CLI, and a desktop shell drive
  identical transitions, which is what makes a future desktop terminal possible
  without a rewrite (`ADR-0014`).
- **Creator documentation is untrusted, and validated at publish time.** MDX is
  parsed and validated before publication rather than rendered as-is at read
  time, only components on an explicit allow-list may appear, and creator
  `import`, `export`, expressions, and arbitrary JSX are unsupported. There is no
  path from a document to `eval`, and no remote image or script origin is
  reachable without a publish-time check (`ADR-0017`).
- **Boundaries that fail the build instead of failing review.** The frontend
  package graph is declared as data and lint fails on an edge that is not in it.
  `packages/tokens`, `packages/contracts`, and `packages/interaction` are
  leaves; deep imports are banned in favour of subpath exports; a phantom
  dependency fails; and layer direction, module isolation, and the policy
  chokepoint are NetArchTest rules (`AGENTS.md` §4.7).
- **Design tokens as the only public visual surface.** `packages/tokens` has no
  dependencies at all and is the single source of every colour, spacing, radius,
  shadow, and motion value. Raw Tailwind colour utilities, arbitrary values,
  colour functions, and inline styles carrying visual properties fail lint
  outside `packages/tokens` (`ADR-0018`).
- **Browser-first user history.** Transcripts, command history, and read state
  live in the client's IndexedDB. The server stores only a TTL-bound session
  descriptor for routing and cleanup — no command text, no output — and clearing
  site data is a supported way to clear history rather than a data-loss incident
  (`ADR-0019`).
- Repository structure, tooling, and architecture for the greenfield platform.
  `AGENTS.md` (working rules), `TODO.md` (phased plan), and `docs/adr/0001`–`0011`
  (decisions).
- `just` task runner for cross-language build, lint, typecheck, test, and
  codegen, with recipes that tolerate absent projects.
- **Secret scanning.** `just secrets` and a mandatory CI job run gitleaks against
  the working tree and the full history, using a single `.gitleaks.toml` shared by
  both paths. Added because the previous implementation committed a GitHub PAT to
  source and nothing caught it.
- pnpm workspace (`apps/web`, `services/auth`, `packages/*`), Go workspace, and a
  .NET SDK pin.
- Placeholder documentation for every component, so the intended boundaries are
  discoverable before the code exists.
- `apps/cli` build-wiring stub, so the Go workspace resolves from the first commit.

### Changed

- **Policy adjudicates every free-form command at runtime.** Commands are no
  longer a declared set: a user may type anything, and so may an AI agent acting
  for one, so `PolicyEvaluator` decides on *every* execution. A command the
  experience declared gets a narrower evaluation, never a bypass, and hiding a
  command in the UI stays a discovery decision rather than a security one. Policy
  still only ever subtracts, and deny by default still holds: unknown image,
  unlisted base, unbounded resource, or unlisted registry is denied
  (`ADR-0015`, superseding `ADR-0010`).
- **One spec schema became three independently versioned schemas** — experience,
  interaction, and session — each with its own `apiVersion` and all feeding one
  codegen target set. `lazarus.yaml` and `lazarus.json` remain one schema in two
  encodings, not two contracts (`ADR-0016`, superseding `ADR-0007`).
- **SQL tables are prefixed by owning module**, so ownership is readable from the
  name: `exp_`, `doc_`, `env_`, `ses_`, `exec_`, `pol_`, `ten_`, `idn_`, `aud_`.
- `TODO.md` rephased into 26 ordered phases. Phases 2–6 are the contract,
  codegen, design-token, boundary, and interaction-core work; 11 is Policy; 16 is
  documentation. Phases are ordered so that any prefix is shippable, and Phase 11
  blocks 12, 14, and 15.
- Execution lifecycle events are designated for the durable outbox rather than
  at-most-once in-memory dispatch, so a completed execution cannot vanish from a
  transcript because a process died (`ADR-0003` as applied by `ADR-0013`).

### Fixed

- Pinned every GitHub Action to a version that runs on current hosted runners.
  The previous pins targeted Node 20, which GitHub removed from hosted runners on
  2026-09-16; CI would have failed on every job.
- `.gitignore` matched `**/secrets/`, which also matches
  `Lazarus.Modules.Secrets/` on a case-insensitive filesystem and would have
  silently dropped that module from version control.
- `.gitattributes` marked `*.sln` as generated, hiding its diff from review. The
  solution is hand-authored.

### Removed (breaking)

- **Delivery.** Spec-driven builds, image builds, and deployments are gone. A
  spec describes an experience — documentation, environment, and commands — not
  something to ship.
- **Subdomain-per-deployment routing, and wildcard ACME for user workloads**
  (`ADR-0012`, superseding `ADR-0006`). The edge terminates TLS for Lazarus's own
  UI and API and for nothing else. A session's environment has no ingress route,
  and network egress from a session is policy-controlled and deny-by-default.
- **The CI pipeline** — checkout, build, test, scan, deploy. There is no
  pipeline: a session is not a build.
- **The web terminal.** No PTY, no `TtyAlloc`, no `xterm.js`, no `node-pty`, no
  `xterm-addon-*`, and no shell. Commands are discrete executions that stream
  structured events — started, output chunk, exit, cancelled — with no cursor and
  no scroll region (`ADR-0013`).
- **Session port publication.** A session is temporary, expires on a
  server-enforced TTL, and is never given a stable publicly reachable address. If
  a future feature genuinely needs an inbound path, it needs its own ADR
  (`ADR-0012`).
- **GitHub source sync**, and the GitHub App install flow that fed it. Publishing
  reads a `lazarus.yaml` or `lazarus.json` submitted directly, by the CLI, or by
  any other software over the API; there is no connected-repository import path
  and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are no longer configuration.
- **Interactive programs.** Anything that requires a TTY — `vim`, `top`, an
  interactive `psql` — does not run. That is the same decision as the removal of
  the terminal, and it is listed so a future request for it is recognised as a
  re-opened decision rather than a bug (`ADR-0013`).
- `docs/spec-reference.md`, the reference for the delivery spec. It described a
  contract that no longer exists. Its replacement is
  `docs/experience-reference.md` (`TODO.md` 2.6).
- The entire previous implementation: `front-end/` (16,589 LOC), `main-backend/`,
  `lazarus-cli/`, and `backend/`. Nothing was carried over — see `ADR-0008`.
  This included a graph/flow editor, document-editing remnants, Supabase auth, a
  partially-implemented Kubernetes path, and two superseded Node backends.

### Security

- **A session is not an attack surface.** With no ingress route, no published
  ports, and a server-enforced TTL, there is no long-lived publicly reachable
  container for an attacker to find. The web terminal it replaces was one
  (`ADR-0012`).
- **Every execution is decided, not just the declared ones.** The untrusted-input-
  to-RCE path is now closed at the chokepoint for arbitrary user and agent input,
  not only for a spec's declared command set (`ADR-0015`).
- Removed a GitHub personal access token that had been committed to source. The
  token itself must still be revoked at the provider — see `TODO.md` 0.1 for the
  exact steps. No repository change can invalidate a credential; deletion of the
  file containing it does not.
- Removed a client-supplied path-traversal write primitive in the previous backend,
  which combined with absent authentication and `cors: '*'` to permit unauthenticated
  remote code execution.

## Versioning policy

Lazarus is pre-1.0, so minor versions may carry breaking changes.

| Change | Bump | `apiVersion` |
|---|---|---|
| Breaking change before 1.0 | minor | unchanged |
| Additive spec field (new optional) | minor | unchanged |
| Spec field removed, renamed, or retyped | minor | **new** |
| Public API endpoint removed or retyped | minor | unchanged |
| Bug fix, internal refactor, docs | patch | unchanged |

A spec change that removes, renames, or retypes a field is breaking for every user
with an existing `lazarus.yaml`. It requires a new `apiVersion`, a documented
migration path, and an ADR (`AGENTS.md` §4.6).

## Deprecation policy

- A deprecated API endpoint keeps working for at least one minor release and
  responds with a `Deprecation` header and a `Sunset` header.
- A deprecated spec field is accepted and ignored with a warning, for at least one
  minor release, before it is removed.
- Removals are announced in this file under `Deprecated` with a replacement.

[releases]: https://github.com/Muhammad-Jay/lazarus-cloud/releases
[keepachangelog]: https://keepachangelog.com/en/1.1.0/
[semver]: https://semver.org/spec/v2.0.0.html