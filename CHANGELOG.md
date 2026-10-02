# Changelog

All notable changes to Lazarus are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

Nothing released yet.

### Added

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

### Fixed

- Pinned every GitHub Action to a version that runs on current hosted runners.
  The previous pins targeted Node 20, which GitHub removed from hosted runners on
  2026-09-16; CI would have failed on every job.
- `.gitignore` matched `**/secrets/`, which also matches
  `Lazarus.Modules.Secrets/` on a case-insensitive filesystem and would have
  silently dropped that module from version control.
- `.gitattributes` marked `*.sln` as generated, hiding its diff from review. The
  solution is hand-authored.

### Removed

- The entire previous implementation: `front-end/` (16,589 LOC), `main-backend/`,
  `lazarus-cli/`, and `backend/`. Nothing was carried over — see `ADR-0008`.
  This included a graph/flow editor, document-editing remnants, Supabase auth, a
  partially-implemented Kubernetes path, and two superseded Node backends.

### Security

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