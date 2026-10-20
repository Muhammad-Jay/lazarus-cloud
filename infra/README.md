# infra

Everything needed to run Lazarus. **No application code belongs here.**

This directory is the reference implementation of the self-hostable constraint
(`AGENTS.md` §1): one person, one machine, one command, no external dependency.

## Layout

| Path | Holds | Phase |
|---|---|---|
| `compose/` | The reference one-command install | 11.1 |
| `edge/` | Edge/proxy templates for ACME and LAN/self-signed modes | 11.3 |
| `docker/` | Dockerfiles for runtime images | 11.1 |
| `devenv/` | `.devcontainer` reproducing the full stack | 11.1 |
| `scripts/` | Install, upgrade, backup, restore helpers | 11.5 |

## The one-command install

```sh
cp .env.example .env
$EDITOR .env          # set BETTER_AUTH_SECRET and LAZARUS_MASTER_KEY
just dev-up
```

Compose brings up Postgres, `services/auth`, `apps/control-plane`, `apps/web`,
and the edge proxy.

## TLS has to degrade honestly

| Situation | Behaviour |
|---|---|
| Install owns a domain, ACME enabled | Wildcard ACME via edge proxy |
| No domain | Self-signed CA + LAN hostname |
| Local development | Plain HTTP, `LAZARUS_DEV_MODE=true` |

No code path may assume a real certificate exists. This is tested, not asserted.

## Rootless podman

The control-plane is the only process with access to the podman socket. Other
services never see it.

## Status

Planned. The one-command install is an acceptance criterion (Phase 11).
