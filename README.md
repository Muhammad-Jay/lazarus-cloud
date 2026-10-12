<div align="center">

# Lazarus

**Interactive documentation and software execution.**

Publish an experience. Let someone read it, compose real commands, and run them
against a real environment — with real output.

</div>

---

## What it does

Lazarus runs real software for people who are learning it or working with it.
`ls`, `curl`, `git`, `grep` — whatever the environment provides actually runs,
and nothing is ever simulated.

**1. Read the documentation.** A creator publishes an *experience*: prose, a
prepared environment, and metadata about the commands it documents. Reading it is
the entry point, not a sidebar attached to something else.

**2. Compose a real command.** Hover a command to see what it does. Pick a task
and get the commands that accomplish it. Or type something the experience never
mentioned — `| grep`, a redirect, a typo. Exploration means going off-script.

**3. Execute it and read the result.** Every command runs in an isolated,
temporary, digest-pinned environment and streams back what the program actually
printed, as structured output you can read and search. The transcript is a record,
not a scrollback buffer.

The whole thing is one feature, not two. The value is the connection: hovering a
command shows what it does, and executing it puts real output in the same
transcript as the documentation that explained it.

## Quick start

```sh
git clone https://github.com/Muhammad-Jay/lazarus-cloud.git
cd lazarus
cp .env.example .env

# Generate the two secrets the platform cannot start without:
#   BETTER_AUTH_SECRET    signs sessions
#   LAZARUS_MASTER_KEY    encrypts stored secrets
$EDITOR .env

just dev-up
```

That is the whole install. It runs on one machine, needs no cloud account, and
works with no owned domain — see [TLS](#tls-without-a-domain) below.

Requires Docker, [rootless podman](https://podman.io), Node 22, Go 1.26, and the
.NET 10 SDK. Exact versions are pinned in `.tool-versions`.

## How it fits together

```
   browser ─┐                    ┌──────────────────┐
  Go CLI ───┼── JWT ────────────►│  services/auth   │ Better Auth
 AI agent ──┘                    │  ES256 · JWKS    │
   (API key)                     └────────┬─────────┘
                                            │ publishes keys
                                            │ validated locally
        ┌───────────────────────────────────┴───────────────────┐
        │                                                       │
        ▼                                                       ▼
┌───────────────┐                                    ┌────────────────────┐
│   apps/web    │  session cookie                    │ apps/control-plane │
│   Next.js 16  │  composition only                  │ .NET 10            │
└───────┬───────┘                                    │ modular monolith   │
        │                                            └─────────┬──────────┘
        │ consumes                                          │
        ▼                                           every container, exec,
┌──────────────────────────┐                          and network operation
│  packages/interaction    │                          is behind PolicyEvaluator
│  framework-free core     │                                    │
│  reducer · transcript    │                                    ▼
└──────────────────────────┘                          ┌─────────────────────┐
                                                      │   rootless podman   │
 apps/desktop (Tauri) ──► same package                │  exec · stream      │
                            ▲                         │  no ingress route   │
                            │                         └─────────────────────┘
                  ┌─────────────────────┐
                  │  Edge · TLS for our │
                  │  own UI and API only│
                  └─────────────────────┘
```

Nothing in the platform needs a network call to validate an identity. `services/auth`
publishes a JWKS document; every consumer verifies locally against it.

`apps/web` and `apps/desktop` are both just clients of
`packages/interaction`, which is why a desktop terminal is a new shell rather
than a rewrite.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16. Composition only — all logic is in `packages/` |
| `apps/desktop` | Tauri shell. No interaction logic |
| `apps/cli` | The `lazarus` CLI. Go 1.26 |
| `apps/control-plane` | The engine. .NET 10, modular monolith |
| `services/auth` | Better Auth. The platform's trust root |
| `packages/interaction` | The interaction model. Framework-free, implemented once |
| `packages/tokens` | Every colour, spacing, radius, shadow, motion value |
| `packages/` | All TypeScript logic, including the contracts |
| `infra/` | Compose, Dockerfiles. No application code |
| `docs/` | Architecture, ADRs, module boundaries, runbooks |
| `tools/codegen` | Everything generated, from the contracts |

## Contributing

Read [`AGENTS.md`](./AGENTS.md) first. It is the authority on how to think, how
to behave, how to keep code consistent, and how to hold boundaries. It is
enforced by CI, not by review.

Work is tracked in [`TODO.md`](./TODO.md), phase by phase, item by item.

```sh
just            # list every task
just check      # format, lint, typecheck, test, build — the CI gate
just dev-up     # the full local stack
```

## Design commitments

These are constraints, not aspirations. A change that violates one needs an ADR.

- **Self-hostable.** One person, one machine, one command. No mandatory external
  service. The base domain is install-time configuration, never a constant.
- **Deny by default.** No container, image, exec, filesystem, or network
  operation runs without a policy decision — and *every* command is adjudicated,
  not only the ones an experience declared. Policy can only subtract.
- **The schema is the contract.** Experience, interaction, and session each have
  a versioned JSON Schema that generates TypeScript, C#, and Go. Change one and
  all three targets regenerate in the same PR, or the build fails.
- **Boundaries are enforced.** Module isolation, layer direction, the policy
  chokepoint, and the frontend package graph are architecture tests. A violation
  fails the build.
- **The interaction model is implemented once.** Framework-free, in
  `packages/interaction`. A Tauri desktop terminal is a new client, not a
  rewrite.
- **Real output or nothing.** We never fabricate, sample, or prettify what a
  program did not print.
- **No terminal emulator.** No PTY, no `xterm.js`, no `node-pty`. No CI
  pipeline. No published containers. No visual editor — a schema and a form, and
  nothing else.

## TLS without a domain

Self-hosting on a LAN, with no domain you own, still gets HTTPS:

| Situation | Behaviour |
|---|---|
| Install owns a domain | Wildcard ACME via Caddy |
| No domain | Self-signed CA and a LAN hostname |
| Local development | Plain HTTP, `LAZARUS_DEV_MODE=true` |

No code path assumes a real certificate exists. This is tested, not asserted.

## Status

Early. The repository currently contains the architecture, the decisions, the
phased plan, and the toolchain. See [`TODO.md`](./TODO.md) for what exists and
what does not — the honest answer is that `apps/control-plane` and `apps/web` are
specified but not yet built, and that the contracts and the interaction core come
first.

## Licence

MIT. See [`LICENSE`](./LICENSE).