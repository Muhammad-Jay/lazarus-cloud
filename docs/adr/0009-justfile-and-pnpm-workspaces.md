# 0009 — just and pnpm workspaces for cross-language work

**Status:** Accepted
**Date:** 2026-10-02

## Context

The repository holds three toolchains:

| Toolchain | Commands | Native aggregation |
|---|---|---|
| TypeScript | `pnpm -r build`, `lint`, `typecheck`, `test` | pnpm workspaces + Turborepo |
| Go | `go build ./...`, `go vet`, `go test` | Go workspaces, `go.work` |
| .NET | `dotnet build`, `format`, `test` | MSBuild solution |

Each has its own convention for what a build is, and each produces output in its
own place. The interesting operations are cross-language: *format everything*,
*check everything*, *generate contracts for all three runtimes*, *run the whole
test suite*. Those need one entry point.

The tempting answer is a polyglot task runner. It adds a tool, a config language,
and a plugin ecosystem to solve a problem that is roughly twenty shell lines.

The other tempting answer is to lean on an existing aggregator. Turborepo is
excellent and TS-centric, but wrapping `dotnet build` and `go test` in it means
writing a plugin per non-TS toolchain, and the failure mode is a CI cache that
quietly serves a stale `.NET` build because the plugin's inputs were under-specified.

A third option is a monorepo framework that wants to own the repository layout.
Rejected on sight: a framework that dictates directory structure is in direct
conflict with a layout already specified in `AGENTS.md` §3.

## Decision

**`just` is the single cross-language entry point; pnpm workspaces handle all
TypeScript.**

- **`justfile` at the repository root** owns every cross-language operation:
  `install`, `codegen`, `fmt`, `fmt-check`, `lint`, `typecheck`, `build`, `test`,
  `check`, and the `dev-*` compose recipes.
- **`just check` is the gate** (`AGENTS.md` §13). It is the one command CI runs and
  the one command a contributor runs before pushing.
- **pnpm workspaces** cover `apps/web`, `services/auth`, and `packages/*`, with a
  `catalog:` for version consistency. TypeScript work stays inside
  `pnpm -r <script>` and never appears in the `justfile`.
- **Go workspaces** (`go.work`, plus `apps/cli/go.mod`) resolve the CLI module.
- **A pinned .NET SDK** via `global.json`, and a `Directory.Build.props` for shared
  settings.
- **`just --fmt`** formats the `justfile` itself.

The `justfile` has one rule that matters more than it looks:

> **Every recipe tolerates a missing project, and says so.**

The repository is built bottom-up, so most components do not exist on day one. A
recipe that fails because `apps/control-plane` has no `.sln` would make the
toolchain unusable exactly when it is most needed — while scaffolding. So each
recipe checks for a **real marker file** (a solution, a `package.json`), not merely
for a directory, and prints `skipped` rather than succeeding silently.

That distinction is not hypothetical: `dotnet format <empty directory>` exits 128
with an unhandled exception rather than a clean no-op, so a directory-existence
guard is not good enough.

Skipped output is loud on purpose. A green run must never be mistaken for a full
verification of code that does not exist yet.

## Consequences

### Positive

- **One entry point, no new dependency.** `just` is a single static binary with no
  plugin ecosystem to go wrong.
- **`just check` is unambiguous.** One command means the same thing locally and in
  CI, so "works on my machine" has a concrete definition.
- **TypeScript gets the tool it deserves.** `pnpm -r` with a dependency catalog is
  better than reimplementing workspace resolution in shell.
- **Version pinning is centralised.** `.tool-versions`, `global.json`,
  `pnpm-workspace.yaml`, and `.env.example` are the four places a version lives, and
  each has exactly one job.
- **Scaffolding works from commit one**, because nothing hard-fails on absent code.
- **Cross-language codegen has a natural home.** `just codegen` runs every generator
  in the right order.

### Negative

- **`just` must be installed.** One more prerequisite, on top of Node, pnpm, Go,
  and the .NET SDK. Documented in `CONTRIBUTING.md`.
- **Two levels of abstraction for TypeScript work.** `just build` delegates to
  `pnpm -r build`. Someone must know which layer a command lives at.
- **The `justfile` grows as the repo grows.** Fifteen modules means more recipes, and
  it needs maintenance and `--fmt`.
- **Skipped output is noisy on a partial repository.** Nine `skipped` lines on day
  one. Accepted, because the alternative — silence — is worse.
- **No built-in parallelism or caching.** `just` runs recipes sequentially. Build
  times are the sum of the parts.
- **Recipe shell bugs are real bugs.** `just` hands lines to the shell verbatim, so
  `$$` in a recipe is a shell PID, not an escape. This cost an afternoon once and is
  now documented in the `justfile` header.

### Neutral

- `just` is not a package manager; `pnpm install` and `dotnet restore` still run
  themselves.
- CI calls `just` recipes rather than duplicating the logic in YAML, so CI and local
  cannot diverge.
- The `justfile` uses `bash` explicitly (`set shell`), so behaviour does not vary by
  platform shell.

## Alternatives considered

**Turborepo as the aggregator.** Rejected as the sole entry point: it is TS-centric,
and wrapping `dotnet build` requires plugins whose input hashing is easy to get
subtly wrong, producing a CI cache that serves stale .NET builds. Turborepo remains
a fine *internal* tool for TypeScript tasks if pnpm proves insufficient, but it does
not own cross-language orchestration.

**Nx.** Rejected: it wants to own the repository layout and the build graph through
a plugin model. Its project-graph inference is a large amount of machinery for a
three-language repo, and its ownership of layout conflicts with `AGENTS.md` §3.

**Bazel.** Rejected: excellent at hermetic cross-language builds, and a poor fit for
a team of this size. Its learning curve, its own language, and its strictness about
hermeticity are real costs against a product that has not shipped a feature yet.

**Make.** Competitive and familiar. Rejected in favour of `just` on syntax: `just`'s
recipes read top to bottom without tab indentation gymnastics, `just --fmt` exists,
and the installed size and behaviour are simpler. This is a preference, not a
technical argument.

**A shell script.** Rejected: it works for two languages and stops working for
three. Windows support, argument quoting, and error propagation are all ad-hoc in
shell, and `set -euo pipefail` is not enough to make it maintainable.

**Docker Compose for dev orchestration only, no host commands.** Rejected as the
sole answer: it makes contributor setup require a full container stack before
`fmt` works. Compose is for the *runtime* stack (`dev-up`); host toolchains handle
build and check.

## References

- [`../../justfile`](../../justfile) — the recipes
- [`../../AGENTS.md`](../../AGENTS.md) §13 — definition of done, `just check`
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — prerequisites and commands
- [`../../pnpm-workspace.yaml`](../../pnpm-workspace.yaml) — TypeScript workspaces
- [`../architecture.md`](../architecture.md) — deployment topology