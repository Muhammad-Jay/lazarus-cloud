# services/auth

The Lazarus identity service. Better Auth, standalone, self-hosted.

## Why it is separate from the web app

It is the trust root for the entire platform. If auth is embedded in the web app,
then auth availability is coupled to dashboard availability, and the Go CLI and
the Automation API depend on a React application being up.

Standing alone, this service is small and boring, which is exactly what a trust
root should be.

## What belongs here

- Better Auth configuration and routes
- The `organization` plugin — the org claim is the `tenant_id` for Lazarus
- The JWT plugin with **ES256**
- The JWKS endpoint
- Scoped API keys for the Automation API and the CLI

## What does not belong here

Any Lazarus domain logic. This service knows about users, sessions, and
organisations. It does not know what a service, deployment, or endpoint is.

## Trust model

```
                    ┌───────────────────────┐
   browser ────────►│  apps/web             │  session cookie
   Go CLI ─────────►│  services/auth        │  Bearer JWT
   AI / software ──►│  (Better Auth)        │  API key
                    └───────────┬───────────┘
                                │ owns the `auth` Postgres schema
                                │ ES256, JWKS at /.well-known/jwks.json
              ┌─────────────────┴─────────────────┐
              │                                   │
  apps/web validates          apps/control-plane validates
  locally (session)           locally (JwtBearer ← JWKS)
```

Every consumer validates locally. No per-request network hop to the auth service.

### ES256 is not a preference

Better Auth defaults to **EdDSA**. The .NET control-plane validates with
`Microsoft.AspNetCore.Authentication.JwtBearer` against JWKS, and ES256 works
without extra configuration. Changing `BETTER_AUTH_JWT_ALG` away from `ES256`
requires an ADR (`TODO.md` 5.3).

## Status

Not created yet. Lands in Phase 5 of `TODO.md`. The acceptance test for this
service is an integration test inside `apps/control-plane` proving it validates
tokens this service issued (`TODO.md` 5.6).