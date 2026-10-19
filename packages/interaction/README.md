# `@lazarus/interaction`

The Lazarus interaction model, implemented once.

Framework-free. This package imports nothing but `@lazarus/contracts` and reaches for no React, DOM,
fetch, storage, timer or clock. It is a leaf in the frontend package graph (`AGENTS.md` §4.7) and
the only place the interaction model is implemented (§4.8) — which is what makes a desktop shell a
new client rather than a rewrite.

Start at `interactionReducer`. Everything else exists because the reducer needs it, and each module
documents why it cannot be somewhere else.

```ts
import { initialState, interactionReducer, interpretOutput } from '@lazarus/interaction';
```

## What belongs here

| Concern                        | Module          | Why it cannot live in a client                             |
| ------------------------------ | --------------- | ---------------------------------------------------------- |
| State transitions              | `reducer.ts`    | Two implementations drift, and only one gets fixed         |
| Event → transcript block       | `transcript.ts` | The transcript is normalised once, at the boundary         |
| Suggestion and search ordering | `ranking.ts`    | A client that ranks its own list disagrees with the others |
| ANSI → semantic roles          | `ansi.ts`       | Colour mapping must be identical everywhere                |
| Block identity                 | `ids.ts`        | Replay is only idempotent if the id is derived, not random |

## What deliberately does not

- **No execution.** Submitting a command is the transport's business. The reducer's input is an
  `executionEvent` like any other; it never runs anything.
- **No policy.** Ranking decides what is easy to reach, never what is permitted. Every command still
  passes a `PolicyEvaluator` at execution time (ADR-0015).
- **No storage.** Browser history is a client concern (§8.1). The reducer's state is a plain value,
  so a client can persist or restore it however it likes.
- **No clock and no randomness.** Both would break purity. `syntheticId` derives ids, and every
  action carries the `at` it should be timestamped with.

## Tests

```sh
pnpm --filter @lazarus/interaction test
pnpm --filter @lazarus/interaction typecheck
```

`test/framework-free.test.ts` enforces the leaf rule by reading this package's source: a React
import, a `localStorage` read, or a `Date.now()` call fails the suite rather than passing quietly
under `environment: 'node'`.

`test/reducer.test.ts` validates every resulting state against the authoritative schema. That is the
part worth keeping — an explicit `undefined` property is present as a key, which `toEqual` ignores
and `additionalProperties: false` rejects, so a reducer can drift from the contract without any
assertion noticing.

## See also

- `AGENTS.md` §4.8 — the interaction model is implemented once
- `docs/contracts-reference.md` — the shapes this package reads and writes
- `docs/adr/0014-framework-free-interaction-core.md`
- `docs/adr/0013-discrete-executions-no-pty.md`
- `docs/adr/0018-semantic-tokens-only.md`
