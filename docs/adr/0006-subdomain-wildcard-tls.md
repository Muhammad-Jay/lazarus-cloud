# 0006 — Subdomain routing with wildcard TLS

> **Superseded.** Sessions are no longer published and there is no
> subdomain-per-deployment routing. See
> [0012 — Sessions are not published](./0012-sessions-are-not-published.md).
> This record is kept for the reasoning that led to wildcard routing, which
> was correct for the previous product.

**Status:** Superseded by [0012](./0012-sessions-are-not-published.md)
**Date:** 2026-10-02

## Context

A deployed service needs to be reachable from the internet over HTTPS, on a
predictable address, with a certificate that a browser trusts. Users deploy many
services and should not need to configure a DNS record per deployment.

The constraint that shapes this decision is self-hosting. There are two materially
different situations, and they must both work:

- The operator owns a domain and can delegate `*.example.com` to their box. Real
  certificates are possible.
- The operator has no domain — a LAN install, an air-gapped box, a homelab. Real
  certificates are **impossible**, and the platform must still work.

A design that assumes a real certificate is a design that breaks the second case.
The failure is also not graceful: browsers show warnings, curl fails, and the
operator concludes the platform is broken.

Separately, the base domain must be **install-time configuration**. If `lazarus.dev`
appears as a constant in code, every self-hosted install serves its tenants'
traffic through the maintainers' domain, which is both a privacy failure and a
single point of failure.

## Decision

Each exposed service is served at **`https://<service>.<base-domain>`**, routed by
an **edge proxy** to the container port allocated by the `Endpoints` module.

- **The base domain is install-time configuration** (`LAZARUS_BASE_DOMAIN`), a
  value in `.env`, never a constant in code. A default of `lazarus.dev` exists in
  `.env.example` as a convenience and nowhere else.
- **The edge is Caddy**, chosen because it obtains and renews certificates without
  configuration and reads a routing table from a file.
- **One wildcard certificate** (`*.example.com`) covers every service. This is the
  point: certificates are obtained once, not per deployment, and adding a service
  needs no DNS change, no ACME round-trip, and no waiting.
- **Wildcard certificates require DNS-01**, so the operator delegates a
  `_acme-challenge` TXT record (or delegates the zone to Caddy). Documented in the
  install guide, not assumed.
- **Without an owned domain**, the platform provisions a **self-signed CA and a LAN
  hostname**, and serves HTTPS with it. Honest degradation: it works, the browser
  warns, and the operator is told why.
- **In local development**, plain HTTP with `LAZARUS_DEV_MODE=true`. A dev-mode
  install that would be publicly reachable is **refused at startup**.
- **No code path assumes a real certificate exists.** Tests cover all three modes.

Endpoint configuration is declarative: `Endpoints` writes routing entries, the edge
reloads, and there is no per-service reverse-proxy container.

Subdomains are opt-in per service. A container with no exposed port gets no
subdomain.

## Consequences

### Positive

- **One certificate for the entire install.** Adding a service is instant and free,
  which is what makes subdomains a good default rather than a premium feature.
- **Self-hosting works without a domain**, honestly and by design. The self-signed
  path is tested, not aspirational.
- **No hardcoded domain anywhere.** An install is not coupled to the maintainers'
  infrastructure, and privacy is a property of the config rather than a promise.
- **Declarative routing.** Configuration is data, so it can be reviewed, diffed, and
  restored.
- **Zero-downtime re-pointing** where possible: routes are swapped rather than
  containers recreated.
- **A leaked subdomain is a recoverable incident.** Removing an endpoint removes
  the route; the runbook is `docs/runbooks/leaked-subdomain.md`.

### Negative

- **Wildcard certificates need DNS-01.** More setup than HTTP-01 for a single
  hostname, and it requires delegation the operator may not have.
- **A self-signed CA is a warning in every browser.** Every user has to click
  through it, which is poor first-run experience and a support burden.
- **The edge is a single point of failure.** Edge down means no traffic, even though
  containers keep running.
- **Certificate expiry can strand an install.** Especially for a self-signed CA
  renewed by an unattended process that stopped running.
- **Wildcard certs do not cover the apex.** `example.com` needs its own
  certificate.
- **Port-based access is gone.** Everything is on 443, so a non-browser client that
  needs a raw protocol must be addressed explicitly.

### Neutral

- The routing table lives on disk under `LAZARUS_DATA_DIR` and is the edge's state.
- Port allocation remains internal; the edge is the only thing that knows the
  mapping.
- TLS termination happens at the edge. Container ports are plain HTTP inside the
  host's network.

## Alternatives considered

**Per-service certificates via HTTP-01.** Rejected: one ACME round-trip and a DNS
record per deployment, plus rate limits. Slow, and it makes the common case of
"expose a port" a multi-step operation.

**A path-based router** (`example.com/app-name`) instead of subdomains. Rejected:
breaks cookie scoping, complicates WebSocket origins, and makes per-service TLS
impossible. Subdomains are the correct isolation boundary and they compose with
wildcard certificates.

**Traefik.** Genuinely competitive and Kubernetes-native. Rejected: it is
Kubernetes-native, and the platform has no Kubernetes. Caddy is smaller, and the
routing table we write is simpler than Traefik's dynamic provider model.

**nginx plus certbot.** Rejected: correct and battle-tested, but it is two
components configured by hand where Caddy is one that does the interesting part
itself. Certificate renewal is exactly the thing that fails silently, so we prefer
the component whose default is to work.

**Terminate TLS at the load balancer or tunnel.** Rejected: a hosted tunnel makes
the control plane externally dependent, violating self-hostability, and adds a
third party to the request path for every deployment.

**Plain HTTP by default with TLS opt-in.** Rejected: it makes the insecure path the
default, which is how deployments end up unauthenticated over HTTP. TLS is the
default; plain HTTP is the local-dev exception, and only with an explicit flag.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §1 — self-hostable is a hard constraint
- [`../architecture.md`](../architecture.md) — deployment topology
- [`../runbooks/leaked-subdomain.md`](../runbooks/README.md) — incident procedure
- [`0011`](./0011-self-hostable-before-scalable.md) — self-hostable before scalable