# services/auth

The Lazarus identity service. Better Auth, standalone, self-hosted.

## Why it is separate from the web app

It is the trust root for the entire platform. If auth is embedded in the web app,
then auth availability is coupled to web availability, and the Go CLI and other
clients depend on a React application being up.

Standing alone, this service is small and boring, which is exactly what a trust
root should be.

## What belongs here

- Better Auth configuration and routes
- Organization support — the org claim is the `tenant_id` for Lazarus
- JWT issuance with **ES256**
- The JWKS endpoint
- Scoped API keys for automation/CLI clients

## What does not belong here

Any Lazarus domain logic. This service knows about users, sessions, and
organizations. It does not know about experiences, documents, or execution.

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

### ES256

Better Auth defaults to EdDSA; Lazarus uses **ES256** for compatibility with
local JWKS validation in the control plane.

## Status

Not created yet. Lands in Phase 7 of `TODO.md`.
