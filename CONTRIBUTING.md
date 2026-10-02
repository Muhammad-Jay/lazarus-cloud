# Contributing to Lazarus

Thank you for your interest. This document covers the mechanics. For how to think,
how to behave, and how to hold boundaries, read [`AGENTS.md`](./AGENTS.md) — that
is the authority, and this document assumes you have.

## Getting set up

Prerequisites. The versions below are pinned in [`.tool-versions`](./.tool-versions),
in the plain asdf format that `asdf`, `mise`, and `fnm` all read.

| Tool | Version | Install |
|---|---|---|
| Node | 22 | [mise](https://mise.jdx.dev) or [asdf](https://asdf-vm.com), then `mise install` |
| pnpm | 10.29.3 | `corepack enable` — pinned in `package.json`, not here |
| Go | 1.26.5 | [mise](https://mise.jdx.dev), or [go.dev](https://go.dev/dl/) |
| .NET SDK | 10.0.112 | [dotnet.microsoft.com/download](https://dotnet.microsoft.com/download) |
| Docker | any recent | [docs.docker.com](https://docs.docker.com) |
| podman | 5.x, **rootless** | [podman.io](https://podman.io) |
| just | any recent | [just.systems](https://just.systems) |
| gitleaks | any recent | [gitleaks](https://github.com/gitleaks/gitleaks#installing) — optional locally, mandatory in CI |

The `.NET` pin appears in two places — `.tool-versions` and `global.json` — and the
`hygiene` CI job fails if they diverge.

```sh
git clone https://github.com/Muhammad-Jay/lazarus-cloud.git
cd lazarus
corepack enable
just install
cp .env.example .env      # then fill in BETTER_AUTH_SECRET and LAZARUS_MASTER_KEY
```

Rootless podman matters. Lazarus runs containers as your user with dropped
capabilities. Running it as root defeats the sandbox the platform depends on.

## Everyday commands

```sh
just            # list every recipe
just check      # format-check, lint, typecheck, secrets, test, build. The CI gate.
just secrets    # scan for committed credentials (gitleaks)
just dev-up     # full local stack
just dev-logs   # tail it
just codegen    # regenerate contracts after a schema change
just            --fmt   # reformat the justfile itself
```

`just check` is the gate. If it does not pass, the change is not ready. Fix the
cause — never weaken a check to get green (`AGENTS.md` §12.6).

`just secrets` prints `SKIPPED` when gitleaks is not installed locally. That is
not a pass: CI runs the scan unconditionally, so a green CI run is authoritative.

## Working on an item

Work is tracked in [`TODO.md`](./TODO.md). Items are numbered `<phase>.<seq>`,
for example `7.8`. Pick the lowest open item whose dependencies are satisfied.

Branch names carry the phase:

```
feat/p07-policy-chokepoint
fix/p09-rollback-retry
docs/p02-spec-reference
```

Before you start, read:

1. `AGENTS.md` — always, and §4 (The Hard Rules) in particular
2. The relevant `docs/modules/<name>.md`, if it exists
3. The ADRs covering the area: `docs/adr/`

## Definition of Done

The full checklist is `AGENTS.md` §13. The short version:

- `just check` passes
- New logic has tests at the layer that owns it
- A bug fix has a test that **failed before the fix**
- No `any`, no `@ts-ignore`, no `eslint-disable`, no empty `catch`
- No new hardcoded URL, port, hostname, ID, email, or path
- Tenant scoping comes from the token, and the query filters by it
- Any container/process/network path goes through `PolicyEvaluator`
- Generated code regenerated and committed if its source changed
- A boundary move updates `docs/modules/<name>.md` in the same PR
- No secrets in the diff

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add policy decision for image allowlist
fix(deployments): do not reject on already-healthy container
docs: record ADR-0012 on outbox durability
refactor(spec): extract shared port value object
test(policy): cover the deny matrix for unbound resources
chore(deps): bump golang.org/x/net
```

A **breaking change** to the spec schema needs a new `apiVersion`, a migration
path, and an ADR. Add the `!` marker and explain the migration in the body.

## Pull requests

One logical change per PR. A refactor and a behaviour change do not travel
together, even when it seems efficient — you cannot review intent and mechanism
in the same diff and do it justice.

The description states:

- what changed
- why
- how it was verified (actual output, not expected output)
- which `TODO.md` item or ADR it satisfies

No force-pushing to a shared branch. No rewriting published history. CI green is
required.

## Three rules people get wrong

**1. Do not hand-edit generated code.** Anything in `packages/contracts`, the
generated spec types, and the Go spec types is produced by `just codegen`. Your
edit is lost on the next run. Fix the generator.

**2. Do not bypass Policy.** If you are reaching podman without a
`PolicyEvaluator` decision, the build fails on an architecture test. This is not
a test to route around — it is the security boundary (`AGENTS.md` §4.5). If
Policy genuinely lacks a capability you need, extend Policy, with a table-driven
test.

**3. Do not disable a check.** Not lint, not a test, not a type error, not a
build flag. Every one of those checks exists because something it caught was a
real defect. If CI is wrong, fix CI in its own PR.

## Reporting security issues

**Do not open a public issue.** See [`SECURITY.md`](./SECURITY.md).

## Code of conduct

Be decent. Assume good faith, review the code rather than the author, and treat
review comments as a shared problem to solve rather than a verdict.

## Licence

By contributing you agree that your contributions are licensed under the
[MIT Licence](./LICENSE).