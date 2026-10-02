# infra

Everything needed to run Lazarus. **No application code belongs here.**

This directory is the reference implementation of the self-hostable constraint
(`AGENTS.md` §1): one person, one machine, one command, no external dependency.

## Layout

| Path | Holds | Phase |
|---|---|---|
| `compose/` | The reference one-command install | 20.1 |
| `edge/` | Caddy templates, per-install routing config | 10.3 |
| `docker/` | Dockerfiles for `apps/web` and `apps/control-plane` | 20.3 |
| `devenv/` | `.devcontainer` reproducing the full stack | 20.5 |
| `scripts/` | Install, upgrade, backup, restore helpers | 20.7 |

## The one-command install

```sh
cp .env.example .env
$EDITOR .env          # set BETTER_AUTH_SECRET and LAZARUS_MASTER_KEY
just dev-up
```

Compose brings up Postgres, `services/auth`, `apps/control-plane`, and the edge
proxy. With `LAZARUS_ACME_ENABLED=false` and a LAN hostname, this works with no
owned domain and no internet dependency.

## TLS has to degrade honestly

| Situation | Behaviour |
|---|---|
| Install owns a domain, `LAZARUS_ACME_ENABLED=true` | Wildcard ACME via Caddy |
| No domain | Self-signed CA + LAN hostname |
| Local development | Plain HTTP, `LAZARUS_DEV_MODE=true` |

No code path may assume a real certificate exists. This is tested, not asserted
(`TODO.md` 10.5, 20.6).

## Rootless podman

The control-plane is the only process with access to the podman socket. The web
app, the auth service, and the edge proxy never see it. The socket is bind-mounted
read-only where the runtime permits it.

## Tested, not claimed

`TODO.md` 20.6 makes the install an acceptance criterion: CI brings up the compose
stack and asserts a service is reachable over HTTPS. A broken install fails the
build.