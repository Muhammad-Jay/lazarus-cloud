# apps/web

The Lazarus dashboard. Next.js 16 (App Router), React 19, TypeScript strict.

## What belongs here

- App Router routes, layouts, and route groups
- Page and feature composition
- Provider wiring (session, realtime, theme)
- Server Components that fetch and pass down

## What does not belong here

Anything that is not composition. No business logic, no data access, no state
machines, no validation rules, no hand-written API clients. All of that lives in
`packages/` (`AGENTS.md` §3).

If you find yourself writing a `useEffect` that fetches, transforms, and decides —
that is a feature slice, and it goes in `packages/feature-*`.

## Status

Not created yet. Lands in Phase 17 (foundation) and Phase 18 (features) of
`TODO.md`.

## Routes

Planned:

| Route | Purpose | Phase |
|---|---|---|
| `/` | Marketing / sign-in entry | 17.1 |
| `/dashboard` | Services, recent deployments, quota usage | 18.2 |
| `/services/[id]` | Releases, deployments, endpoints, config | 18.3 |
| `/deployments/[id]` | Live logs, health, actions | 18.4 |
| `/containers/new` | Launch an instant container | 18.5 |
| `/terminal/[sessionId]` | Web terminal | 18.6 |
| `/endpoints` | Expose a port, subdomain, TLS status | 18.7 |
| `/pipelines` | CI runs and per-step logs | 18.8 |
| `/repositories` | GitHub App connection and repo linking | 18.9 |
| `/spec/[serviceId]` | Spec editor, schema-validated | 18.10 |
| `/settings` | Domain, TLS, secrets, API keys, policy, quota | 18.11 |
| `/docs/api` | Automation API reference | 18.12 |

## Non-negotiables

- `strict: true`. No `ignoreBuildErrors`. No `ignoreDuringBuilds`.
- No `any`, no `@ts-ignore`, no `eslint-disable` (`AGENTS.md` §5, banned list).
- No `console.*` outside `next.config.ts` — use the package logger wrapper.
- Generated code in `packages/contracts` is never hand-edited.