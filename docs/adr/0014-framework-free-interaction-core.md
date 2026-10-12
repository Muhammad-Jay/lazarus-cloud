# 0014 — The interaction model is a framework-free core

**Status:** Accepted
**Date:** 2026-10-04

## Context

Lazarus has, or will have, several clients over the same interaction surface:

- `apps/web` — the Next.js dashboard in a browser
- `apps/desktop` — a Tauri shell for local execution
- `apps/cli` — the Go `lazarus` operator tool

All three need the *same* non-obvious logic. What happens when a command
completes and new suggestions appear. What a transcript looks like when a
`StepStarted` is followed by output and then a policy denial. Whether an edited
command draft survives a context change. How transcript blocks are ordered.

This is exactly the shape that gets reimplemented per client. Two reducers that
start identical diverge within a release, and the divergence is invisible because
each client is internally consistent. The previous implementation failed this way:
`policy`, `tenancy`, and `runtime` each existed twice in two Node backends, and
the weaker copy was the reachable one.

The frontend conventions in `AGENTS.md` say `apps/web` is composition only and all
logic lives in `packages/`. That is necessary but not sufficient — it does not by
itself say which package owns the interaction state machine, and "logic lives in
packages/" is not a boundary. It permits a reducer in `packages/ui`.

## Decision

**The interaction model is implemented once, in `packages/interaction`, as a pure,
framework-free package. No client re-implements any of it.**

- `@lazarus/interaction` imports only `@lazarus/contracts`. **No React, no DOM, no
  Next.js, no transport, no styling, no storage, no timers.**
- State transitions are a **pure reducer**: `(state, action) => state`. Reducer
  input and output are plain values.
- Execution arrives as an **event stream applied to the reducer**. Output is
  never read back out of a component's local state.
- The transcript is **normalised exactly once**, where an `ExecutionEvent`
  becomes a `TranscriptBlock`. Presentation consumes blocks and never parses raw
  output, never reorders blocks, and never re-tokenises.
- Any client-only concern — fetching, WebSocket wiring, IndexedDB persistence,
  focus, animation — lives in `packages/feature-*` or the app, and delegates the
  transition to the reducer.
- `packages/interaction` is a **leaf-adjacent package**: its dependency set is
  fixed at `@lazarus/contracts`, and lint fails if that grows.

Concretely owned by the package: the state shape, the reducer, transcript
normalisation, execution-event application, suggestion ranking, draft-conflict
resolution, and block ordering. Everything a second client would otherwise
reimplement.

## Consequences

### Positive

- A Tauri desktop terminal is a new client, not a reimplementation. This is the
  whole reason for the constraint.
- The reducer is exhaustively testable with table-driven tests over every
  action×event pair, with no React renderer, no jsdom, and no mocks.
- Divergence between clients becomes structurally impossible rather than
  discouraged.
- CI can enforce it: the package graph is a declared DAG, and a new import fails
  the build.

### Negative

- Some transitions need information the package does not have. Those must be
  pushed in as plain data by the client (for example, the resolved experience
  definition), which is more ceremony than reading it from a context.
- A `useReducer` binding, storage sync, and event subscription are real code that
  every client writes. That is deliberate: it is thin, per-client, and contains
  no product logic.
- Any transport that wants to be incremental must be decoupled from the
  reducer's state shape, which constrains how state is versioned.

### Neutral

- The package is not "the state library" for the whole app. Feature-local
  presentation state stays in the feature package.

## Alternatives considered

**Put the reducer in `apps/web` and let other clients re-implement it.** Rejected:
this is the failure mode ADR 0001 was written about. It also makes "apps/web is
composition only" false within a release.

**Write the interaction core in C# and share via the wire contract only.** Rejected:
a wire contract shares *shapes*, not *behaviour*. Every client would still
implement the transitions, which is the duplication we are removing.

**Make the package React-aware and use `useReducer` internally.** Rejected: it
forbids the desktop shell and the Go CLI from consuming the logic, which defeats
the purpose. React also brings its own scheduling, so the reducer stops being a
pure function of its inputs.

**Model execution as an effectful command bus instead of an event stream.**
Rejected: free-form commands mean partial failure and out-of-order arrival are
normal. An event stream that is folded into state is idempotent and orderable; a
command bus is neither.

**Allow `packages/interaction` to import `packages/contracts` transitively via
other packages.** Rejected: `packages/contracts` imports nothing and is generated
types only. A chain that reaches it any other way is an undeclared dependency.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §4.7 — boundaries are enforced
- [`../../AGENTS.md`](../../AGENTS.md) §4.8 — the interaction model is
  implemented once
- [`0013-discrete-executions-no-pty.md`](./0013-discrete-executions-no-pty.md)
- [`0019-browser-first-user-history.md`](./0019-browser-first-user-history.md)
