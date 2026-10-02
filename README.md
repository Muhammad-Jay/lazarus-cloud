<div align="center">

# Lazarus

**A self-hostable container automation platform.**

Launch an isolated container in seconds, or hand it a `lazarus.yaml` and walk away.

</div>

---

## What it does

Lazarus runs containers for you: it builds your code, runs it, gives you a
terminal in the browser, puts it behind HTTPS, and redeploys when you push.

**1. Instant isolated container.** Ask for a container, get a shell. Nothing to
configure, no Dockerfile, no scaffolding. For the twelve-command scripts and
side experiments that do not deserve a deployment pipeline.

**2. Spec-driven automation.** Describe what you want in `lazarus.yaml`. Lazarus
validates it, builds it, runs it, and exposes it. The same spec can come from a
connected GitHub repo, from a form in the dashboard, or as JSON from an AI agent
or any other software — so `curl` can deploy, if you want it to.

**3. Public exposure and CI.** Every exposed port gets a real subdomain with
automatic TLS. Push a commit and the pipeline builds, tests, and deploys without
you configuring a runner.

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
└───────────────┘                                    │ modular monolith   │
                                                     └─────────┬──────────┘
                                                               │
                                              ┌────────────────┴────────────────┐
                                              │            podman               │
                                              │  build · run · exec · ports     │
                                              └────────────────┬────────────────┘
                                                               │
                                                    ┌──────────┴──────────┐
                                                    │  Edge · wildcard TLS│
                                                    └─────────────────────┘
```

Nothing in the platform needs a network call to validate an identity. `services/auth`
publishes a JWKS document; every consumer verifies locally against it.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 dashboard. Composition only — all logic is in `packages/` |
| `apps/cli` | The `lazarus` CLI. Go 1.26 |
| `apps/control-plane` | The engine. .NET 10, modular monolith |
| `services/auth` | Better Auth. The platform's trust root |
| `packages/` | All TypeScript logic, including the spec contract |
| `infra/` | Compose, edge config, Dockerfiles. No application code |
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
- **Deny by default.** No container, image, port, exec, volume, or network
  operation runs without a policy decision. Policy can only subtract.
- **The spec is the contract.** One JSON Schema generates TypeScript, C#, and Go.
  Change it and all three regenerate in the same PR, or the build fails.
- **Boundaries are enforced.** Module isolation, layer direction, and the policy
  chokepoint are architecture tests. A violation fails the build.
- **No visual editor.** No canvas, no node graph. A spec and a form, and nothing
  else.

## TLS without a domain

Self-hosting on a LAN, with no domain you own, still gets HTTPS:

| Situation | Behaviour |
|---|---|
| Install owns a domain | Wildcard ACME via Caddy |
| No domain | Self-signed CA and a LAN hostname |
| Local development | Plain HTTP, `LAZARUS_DEV_MODE=true` |

No code path assumes a real certificate exists. This is tested, not asserted.

## Status

Early. The repository currently contains the architecture, the contracts, and the
toolchain. See [`TODO.md`](./TODO.md) for what exists and what does not — the
honest answer is that `apps/control-plane` and `apps/web` are specified but not
yet built.

## Licence

MIT. See [`LICENSE`](./LICENSE).