# 0004 — Better Auth standalone, with JWT via JWKS

**Status:** Accepted
**Date:** 2026-10-02

## Context

Three consumers need to prove who someone is:

| Consumer | Transport available | Runs on |
|---|---|---|
| `apps/web` | Server-side cookie, no browser tokens | Node / Next.js |
| `apps/control-plane` | HTTP headers and WebSocket handshake | .NET 10 |
| `apps/cli` | Arbitrary API call, no browser | A user's machine |
| AI agents and other software | Arbitrary API call, no browser | Anywhere |

The control plane and the CLI cannot use a browser session, and neither should hold
a long-lived secret. This pushes toward a bearer token. But a *shared secret* token
(HMAC) means the verifier must hold the signing key, so a control-plane compromise
means the attacker can mint tokens for any tenant — which defeats the isolation the
whole design depends on.

The previous implementation used Supabase, which meant a mandatory external hosted
dependency. That is incompatible with self-hosting: an operator with no internet,
or no Supabase account, could not run Lazarus at all.

The user-facing browser has the opposite problem. Putting a bearer token in a
browser makes it reachable by XSS, and session revocation becomes awkward.

## Decision

**`services/auth` is a standalone service running Better Auth**, on its own
Postgres schema, deployed separately from the control plane. It is the platform's
**trust root**.

It issues **asymmetric ES256 JWTs** and publishes a **JWKS document**. Every
consumer verifies tokens **locally** against that document. No request to Lazarus
ever requires a network call to auth in order to be authenticated.

- `apps/web` users get a **server-side session cookie**. No token in the browser.
- `apps/cli` and the Automation API authenticate with an **API key** that the
  control plane exchanges for a short-lived ES256 token, or verifies directly.
- The control plane validates ES256 tokens with `JwtBearer`, validating against the
  JWKS document by URL, with key rotation handled by the document rather than by a
  deployment.
- `services/auth` is **not** referenced by the control plane's projects. It is
  reached over HTTP like any other service, and it lives under `services/`, not
  `apps/`, because it is infrastructure rather than a product surface.

JWKS is served at **`/.well-known/jwks.json`**, proxied from Better Auth's native
`/api/auth/jwks` by the auth service itself. The stable well-known path is exposed
so the URL is a stable contract that Better Auth upgrades cannot break; the alias is
implemented in `services/auth`, not assumed.

Key rotation publishes both keys during the overlap window. Consumers cache with
refresh on unknown `kid`, so rotation does not require a coordinated restart.

Auth being briefly unavailable is not an outage: already-issued tokens verify
locally until expiry, and the JWKS document is cached.

## Consequences

### Positive

- **No shared signing secret in the control plane.** A control-plane compromise
  cannot mint tokens. Verifiers hold only a public key.
- **No auth round-trip per request.** Verification is a local signature check, so
  latency is unaffected and an auth outage is not an outage.
- **Rotation is a JWKS change**, not a coordinated restart across services.
- **Self-hosted.** Better Auth is a self-hostable service on our Postgres; there is
  no mandatory hosted dependency.
- **Auth compromise is separable.** Losing `services/auth` degrades sign-in; it does
  not grant the attacker the ability to forge tokens for services that already hold
  the public key.
- **No browser token.** XSS cannot steal a bearer token, because there isn't one.

### Negative

- **Two authentication mechanisms.** Cookie sessions for the browser, JWTs for
  everything else. Two code paths, two revocation models, two things to get wrong.
- **Token revocation is hard by nature.** A signed JWT is valid until it expires.
  Short lifetimes plus an API-key kill switch on the issuing side is the mitigation,
  and it means "revoke" is not immediate.
- **JWKS caching adds a failure mode.** A stale cache after an emergency rotation
  means rejections, so rotation needs an overlap window.
- **Another service to operate.** Better Auth is a Node process the operator runs.
- **ES256 signature verification cost.** Negligible, but non-zero per request.

### Neutral

- Better Auth's default JWT algorithm is EdDSA; ES256 is configured explicitly. The
  asymmetry is the requirement, and the specific curve is an implementation
  choice.
- The auth schema is owned by `services/auth`, not by a control-plane module. A
  separate PostgreSQL schema is the boundary.

## Alternatives considered

**Self-hosted auth inside the control plane.** Rejected: a control-plane
compromise would then own the signing keys, so the attacker can mint tokens for any
tenant. Separating the trust root from the system it authenticates is the whole
point.

**Keep Supabase.** Rejected: a mandatory external hosted service is a direct
violation of the self-hostable constraint (`ADR-0011`), and the previous
implementation already proved it a liability.

**Build auth from scratch.** Rejected: session management, password hashing, OAuth
provider quirks, and account recovery are a large surface with no product value. We
need auth that is correct and self-hostable, not auth that is bespoke.

**HMAC (shared-secret) JWTs.** Rejected: every verifier holds the signing key, so a
single verifier compromise is a platform compromise. Asymmetric signing is the
control, and it is the reason we accept two token formats.

**Put the session cookie on the control plane and skip JWT.** Rejected: the CLI and
the Automation API still need a non-cookie credential, and giving them one in the
control plane puts the signing key back next to the system it authenticates.

**A local JWKS-only validator with no auth service at all.** Rejected: someone has
to sign, and signing is the part that must be isolated.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §2 — architecture at a glance
- [`../../AGENTS.md`](../../AGENTS.md) §7 — security rules
- [`../architecture.md`](../architecture.md) — components
- [`../threat-model.md`](../threat-model.md) T4 — authentication forgery
- [`0011`](./0011-self-hostable-before-scalable.md) — self-hostable before scalable