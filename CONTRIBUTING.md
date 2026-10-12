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

Rootless podman matters, and it is not optional. Lazarus runs every command a
user types as a real process in a container, as your user, with dropped
capabilities. Running it as root defeats the sandbox the platform depends on.
Docker and rootless podman are both prerequisites for running sessions locally,
and there is no mode in which a session runs without a container runtime behind
`PolicyEvaluator`.

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

### `just codegen`

A schema change **requires** regeneration, and the regenerated output is
committed. One change, every target:

```sh
just codegen && just check
```

Targets are `packages/contracts/src/generated` (TypeScript),
`Lazarus.Contracts` (C#), and the Go spec types in `apps/cli`. If you edit
`packages/spec/lazarus.schema.json` or either
`packages/contracts/src/schema/*.json` and do not commit the regenerated
output, `contract-drift` CI fails. So does a schema change that ships without
its reference-doc update (`docs/experience-reference.md` or
`docs/contracts-reference.md`) (`AGENTS.md` §4.6).

A hand-edit to generated code is lost on the next run. Fix the generator
instead, and never edit a generated file to make a check pass.

## Working on an item

Work is tracked in [`TODO.md`](./TODO.md). Items are numbered `<phase>.<seq>`,
for example `11.5`. The plan was rephased on 2026-10-04 to match the new
product, so an item number from an older checkout means nothing: read the phase
heading, not just the number.

Phases are ordered so that **any prefix is shippable**. Do not start a phase
before its dependencies are green, and do not jump ahead because something
looks easier — the ordering is what makes each phase reviewable on its own.

Pick the lowest open item whose dependencies are satisfied. One item, one PR.

**Phase 11 (Policy) blocks phases 12, 14, and 15.** Do not let container or
exec code land before it. If a runtime or execution path can be reached without
a `PolicyEvaluator` decision, the architecture test fails, and that ordering is
a security property rather than a convenience.

Phase 6 (the interaction core) blocks 20, 21, and 23 in the same way: every
client consumes it, so building a client first means building it twice.

Branch names carry the phase:

```
feat/p11-policy-deny-matrix
fix/p15-exec-event-backpressure
docs/p02-experience-reference
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
- **Interaction logic lives in `packages/interaction`, not in a client**
- **Every visual value comes from a semantic token in `packages/tokens`**
- Generated code regenerated and committed if its source changed
- A boundary move updates `docs/modules/<name>.md` in the same PR
- No secrets in the diff

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add policy decision for the image allowlist
fix(transcript): drop the block when an event arrives twice
docs: record ADR-0012 on sessions not being published
refactor(spec): extract shared port value object
test(policy): cover the deny matrix for unbounded resources
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

Each of these has been got wrong in this repository already. None of them fails
loudly: the lint passes, the build passes, and the defect surfaces later as a
divergence nobody can explain.

**1. Do not reimplement the interaction model in a client.**
`packages/interaction` is framework-free, imports only `@lazarus/contracts`, and
owns the state shape, the reducer, transcript normalisation, execution-event
application, suggestion ranking, draft-conflict resolution, and block ordering.
`apps/web`, `apps/cli`, and `apps/desktop` all drive the same transitions — that
is the point (`ADR-0014`). If a component needs to decide what happens next,
that is a missing transition in the reducer, not a missing `useEffect`. Two
reducers that start identical diverge within a release, and the divergence is
invisible because both look right in review.

**2. Do not hand a component a colour.** Semantic tokens in `packages/tokens`
are the only public visual surface, and lint fails on `bg-red-500`,
`bg-[#0f172a]`, `rgb()`, `hsl()`, `oklch()`, and an inline `style={{}}` carrying
a visual property (`ADR-0018`). The correct path is: add the value to
`packages/tokens`, regenerate, and reference the semantic name. Note that a
component written against a raw value also breaks dark mode, which swaps tokens
and adds no component-level `dark:` variants.

**3. Do not treat a declared command as an allowed command.** A user may type
anything, and so may an AI agent acting for one, so `PolicyEvaluator`
adjudicates *every* execution at runtime — a declared command gets a narrower
evaluation, never a bypass (`ADR-0015`). Hiding a command in the UI, or leaving
it out of the experience, is a **discovery** decision. If it must not run,
Policy says so, and nothing else can grant it: no spec field, no request
payload, and no operator flag. If Policy genuinely lacks a capability you need,
extend Policy, with a table-driven test over the decision matrix.

## Reporting security issues

**Do not open a public issue.** See [`SECURITY.md`](./SECURITY.md).

## Code of conduct

Be decent. Assume good faith, review the code rather than the author, and treat
review comments as a shared problem to solve rather than a verdict.

## Licence

By contributing you agree that your contributions are licensed under the
[MIT Licence](./LICENSE).