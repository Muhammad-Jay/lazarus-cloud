# Interaction and session contract reference

The interaction and session contracts are ours, not creator-authored. They are
authoritative in JSON Schema and nothing else describes them.

| Schema | Path | Changes when |
|---|---|---|
| Interaction | [`packages/contracts/src/schema/interaction.schema.json`](../packages/contracts/src/schema/interaction.schema.json) | The product's behaviour changes |
| Session | [`packages/contracts/src/schema/session.schema.json`](../packages/contracts/src/schema/session.schema.json) | Session lifecycle changes |

They version **independently** of each other and of the experience contract, so
an internal refactor is never a breaking change to published creator content
([ADR-0016](./adr/0016-three-versioned-schemas.md)).

`packages/contracts` is a **leaf**: it imports nothing at all
([`AGENTS.md`](../AGENTS.md) §4.7). Generated types are re-exported from the
package root; consumers never import another package's `src/`.

---

## Interaction

The interaction model, as plain data. The web app, the CLI, and a future desktop
shell all drive the same transitions, because the transitions are a pure reducer
in `@lazarus/interaction` — no React, no DOM, no fetch, no storage, no timers.

### Root

| Field | Required | Notes |
|---|---|---|
| `context` | yes | Where the reader is. |
| `draft` | no | What they have composed, or `null` when empty. |
| `suggestions` | yes | `{ items: CommandSuggestion[] }`, ≤200. |
| `search` | yes | `{ results: DocumentationSearchResult[] }`, ≤50. |
| `actions` | yes | `{ items: Action[] }`, ≤100. |
| `blocks` | yes | `{ blocks: TranscriptBlock[] }`, ≤10000. |
| `draftConflict` | no | Present only when a context change would replace an edited draft. |

`additionalProperties` is `false`. Reducer input and reducer output are this
shape, so a client and the reducer cannot disagree about what state is.

### `DocumentationRef`

A core interaction entity (`LAZARUS_MODEL.md` §5.1), not a convenience.
Documentation search, command suggestions, actions, structured output, inline
content and transcript blocks all carry one, so the explanation a reader sees on
hover is the same reference the transcript cites rather than a second copy of the
prose.

| Field | Required | Notes |
|---|---|---|
| `documentId` | yes | |
| `title`, `anchor` | no | |
| `summary` | no | ≤300 chars, for popovers without opening the document (§4.5). |
| `relatedCommandIds` | no | ≤50, for popovers and search results (§6.3). |

`relatedCommandIds` is a **display hint only**. The authoritative command-to-document
mapping lives in the experience contract and the reverse index is derived from it
rather than authored twice.

### `DocumentationSearch`

Search is part of the workspace, not a separate destination (§4.4). A result may
populate a draft, change context, or reveal options — but no execution state
appears anywhere in this shape, because selecting a result must never imply an
operation happened.

`kind` is `document`, `task`, `command`, or `concept`, so a client knows what
selecting a result means without inspecting the payload. `score` is 0–1 and
`excerpt` is ≤400 chars.

### `LocalSession`

The reader's own browser-side record (`LAZARUS_MODEL.md` §8). **Not** the runtime
session and **not** the server's coordination descriptor — §8.3 gives those three
separate lifecycles, so they are separate types.

| Field | Required | Notes |
|---|---|---|
| `schemaVersion` | yes | For migration. §8.2 calls migrations out explicitly. |
| `id`, `experienceId` | yes | |
| `context` | yes | Reuses `WorkspaceContext`. |
| `transcript` | yes | Reuses the `transcript` wrapper. |
| `createdAt`, `updatedAt` | yes | |
| `draft` | no | Structured, not a raw string, so it restores in the shape the reducer reads. |
| `runtimeSession` | no | `LocalRuntimeLink` or `null`. |
| `expiresAt` | no | |

It deliberately has **no `tenantId`**, **no routing metadata** and **no
credentials** — all three are rejected by test. Sensitive values must not sit in
browser storage for convenience (§8.1), and local history must not be attributable
from browser data alone.

`LocalRuntimeLink.state` mirrors the server descriptor's vocabulary and adds
`unknown`. A restored transcript must not imply the old runtime is still alive
(§8.4), and the honest answer after a tab has been closed a while is `unknown`,
not `ready`. `lastConfirmedAt` is when the client last heard from the runtime, so
"no news" is representable.

Timestamps are RFC 3339 rather than the epoch milliseconds of the model's
illustrative type (§8.2), because the rest of this contract does not let two
runtimes disagree about a time unit. Retention limits are an open decision (§17),
so no policy is encoded here.

`localSession` and `executionRequest` are **unreachable from the root** — each is a
standalone document rather than a field of interaction state. They have their own
fixture suites so their fields are not left unvalidated.

### `WorkspaceContext`

`experienceId` and `experienceVersion` are required; `documentId`, `sessionId`,
`workingDirectory`, and `taskId` are nullable.

Changing context must not execute anything. When it would replace a draft, the
rule is explicit: an **unmodified** draft is replaced, a **modified** one raises
`draftConflict`, and the client asks. The interaction core decides; the client
does not.

### `CommandDraft`

| Field | Required | Notes |
|---|---|---|
| `executable` | yes | `^[A-Za-z0-9._/-]+$` — shared with the experience schema via one definition. |
| `arguments` | yes | ≤128 `CommandArgument`. |
| `sourceCommandId` | no | Provenance for discovery. **Never** authorisation. |
| `modified` | no | Default `false`. This flag is the whole of the conflict decision. |

A command is an argument list, never a shell string
([ADR-0013](./adr/0013-discrete-executions-no-pty.md)).

### `CommandSuggestion`

`kind` is one of `documentedCommand`, `executableName`, `taskStep`,
`historyEntry` — a discriminated union, so a client never guesses which fields
are meaningful. Optional: `detail`, `draft`, `score` (0–1), and `doc` as a
`DocumentationRef`.

`doc` replaced a bare `documentId` because a suggestion's documentation has to
be an explicit reference with a popover summary and related commands, not an id
the client resolves itself.

**Ranking is computed once**, in `@lazarus/interaction`. No client re-implements
it.

### `Action`

`kind` is one of `openDocument`, `startTask`, `reuseCommand`, `clearTranscript`,
`cancelExecution`, `endSession`. Each needs `id`, `kind`, `label`. Optional:
`doc` (`DocumentationRef`), `taskId`, `executionId`, `disabledReason`.

A disabled action **always** carries `disabledReason`. A silently inert control
is a bug.

### `ExecutionRequest`

`sessionId`, `executable`, and `arguments` are required. Every execution passes
a `PolicyEvaluator` decision first, whether or not the experience declared the
command ([ADR-0015](./adr/0015-policy-adjudicates-every-command.md)).

### `PolicyDecision`

`outcome` is `allowed` or `denied`. `code` is a stable machine-readable token
(`^[a-z][a-z0-9_]*$`); presentation maps it to prose, so the code never embeds
user-facing wording.

A denial is as auditable as an allow. Free-form commands mean the deny path is
common, not exceptional.

### `ExecutionEvent`

A discriminated union on `kind`:

| `kind` | Required payload |
|---|---|
| `executionStarted` | `executionId`, `command` — optional `decision` |
| `executionOutput` | `executionId`, `sequence`, `output` |
| `executionCompleted` | `executionId`, `exitCode` |
| `executionCancelled` | `executionId` — optional `reason` |
| `executionDenied` | `executionId`, `decision` |
| `executionFailed` | nullable `executionId`, optional `code`, `message` |

Structured events rather than a byte stream: a transcript has to be orderable,
searchable, and testable, and none of those is true of bytes.

### `TranscriptBlock`

Produced **exactly once**, where an `ExecutionEvent` becomes a block. A
discriminated union on `kind`: `command`, `output`, `result`, `notice`,
`policyDenied`, `documentation`. Every block carries a stable `id` and `at`.

Blocks are appended in event order and **never reordered** by presentation.

### `RichOutput`

`spans` holds text with a `stream` of `stdout` or `stderr` — preserved, because
interleaving is part of what the program actually printed — and an optional
`textStyle`.

`textStyle` carries **semantic roles only**: `color` is a `ColorRole`
(`default`, `muted`, `accent`, `success`, `warning`, `danger`, `info`, `stdout`,
`stderr`), never a literal colour
([ADR-0018](./adr/0018-semantic-tokens-only.md)).

ANSI handling here is a **filter, not an emulator**. Cursor movement and erase
are stripped rather than emulated, because a transcript is a record rather than a
screen. `truncated` is always disclosed: output is never silently shortened.

### `StructuredOutput`

Output recognised as structured content (§4.6). A discriminated union of
component types a renderer knows how to instantiate — never arbitrary content.

| `kind` | Carries |
|---|---|
| `data` | A JSON **object or array** plus `dataType`. Deliberately not scalars: structured data is structured, and a scalar belongs in `raw`. |
| `section` | `label`, `expandedByDefault`, and an `InlineContent[]`. |
| `options` | `OutputOption[]` — a dropdown. |
| `links` | `OutputLink[]`, with `external` as a fact about what was checked. |
| `commandPills` | `CommandPill[]`. |
| `documentation` | A `DocumentationRef`. |
| `control` | `label`, `value`, and `actionIds`. |

**Every branch requires `raw`**, carrying the text the program actually printed.
This is the mechanism behind two things the model insists on:

- A rich renderer must not fabricate or silently alter the execution result (§4.6).
- Unrecognised or invalid structured output must fall back to a safe
  representation such as plain text (§10.3).

Neither is achievable unless the raw text travelled with the structure. So
presentation is **layered on top of** real output and is never a replacement for
it. `structured` is optional and rides alongside `spans`; when a renderer cannot
instantiate a component type it renders `spans`.

A `control` names **declared** actions rather than carrying behaviour (§5.3).
Command output may request an operation the product already knows about; it may
never introduce new behaviour. That is what stops a program's output from
becoming executable UI (§13), and `script` is not expressible.

`CommandPill` is a pill-shaped element for a command or a command fragment (§4.3).
`draft` is a complete command, `fragment` is display-only text that is never
submitted, and `prepared` distinguishes a prepared sequence from commands that
actually executed. Selecting a pill composes or reveals — it never executes,
because a suggestion that silently executes is explicitly not allowed.

### `InlineContent`

A discriminated union on `kind`, covering the inline kinds §10.2 lists:

| `kind` | Notes |
|---|---|
| `text`, `emphasis`, `code` | Plain inline text. |
| `link` | Destination origin checked at publish time. |
| `commandRef` | A documented command rendered with its summary — the join between docs and interaction. |
| `documentationRef` | A `DocumentationRef`, so output can explain itself with the creator's documentation. |
| `control` | Names `actionIds`; carries no behaviour. |
| `pill` | A `CommandPill` inside documentation or a transcript. |

### What the interaction contract cannot express

Asserted by `packages/contracts/test/interaction-schema.test.ts`, so adding one
fails the build:

`pty`, `terminalFrame`, `cursorPosition`, `screen`, `scrollback`, `rows`,
`cols`, `shell`, any literal hex colour, `rgb(`, `hsl(`.

Two further boundaries are enforced by fixtures rather than by a keyword scan,
because they are about a field being *absent*:

| Not expressible | Enforced by |
|---|---|
| Structured output without `raw` — i.e. presentation that replaces the real result | `invalid/structured-without-raw.json` |
| A control that carries behaviour instead of naming declared actions | `invalid/control-without-actions.json` |
| A `tenantId`, a credential, or any unknown field on `LocalSession` | `def-localSession/invalid/with-tenant-id.json`, `with-secret-value.json` |
| A runtime state the server would not recognise | `def-localSession/invalid/unknown-runtime-state.json` |

---

## Session

A session descriptor and its lifecycle. **No command text and no output.** User
history lives in the client; the server stores only what it needs to route a
reconnection and reap an expiry
([ADR-0019](./adr/0019-browser-first-user-history.md)).

A transcript is the most sensitive data Lazarus holds, and **nothing in the
product queries it server-side**.

### Root

| Field | Required | Notes |
|---|---|---|
| `descriptor` | yes | Everything the server stores. |
| `limits` | yes | The bounds the session was admitted under. |
| `ticket` | no | Present on start and reissue; `null` once redeemed. |
| `hubUrl` | no | Root-relative, not protocol-relative. |

### `SessionDescriptor`

`sessionId`, `tenantId`, `experienceId`, `experienceVersion`, `state`,
`createdAt`, `expiresAt` are required. Optional: `endedAt`,
`environmentImage`, `failureCode`.

- `tenantId` comes from the **validated token** at session start — never from a
  request body, query parameter, or URL segment — so a caller can never choose
  their tenant. It is required, not optional.
- `state` is one of `starting`, `ready`, `ended`, `expired`, `failed`. Exhaustive
  by construction, so a client `switch` is checked at compile time.
- `environmentImage`, when present, must be **digest-pinned**. A tag is not an
  identity.
- `failureCode` is a stable code, never an internal exception message.

If a field is not in the descriptor, the server does not have it.

### `SessionLimits`

`maxDurationSeconds` (≥30), `maxExecutions` (≥1), and `maxConcurrent` (≥1) are
required; `remainingExecutions` is nullable. Returned so a client can explain a
refusal *before* it happens.

### `ReconnectionTicket`

`ticket`, `sessionId`, `expiresAt` are required. `ticket` is ≥32 characters.

Deliberately **not** the session id: a guessable identifier that reattached on
its own would be an authentication bypass. Single-use — present on start and
reissue, `null` once redeemed, so a reconnected client cannot retain a usable
credential.

### `SessionEvent`

A discriminated union on `kind`: `sessionStateChanged` (carries `state`) and
`sessionClosing` (carries `reason`). Execution output is a **separate stream**;
this one carries state changes and lets a client stop listening.

### `hubUrl`

Root-relative and **not** protocol-relative: `^(?!//)/[A-Za-z0-9._~/-]*$`.

The base address is operator configuration, so no code path can hardcode an
endpoint. The negative lookahead closes protocol-relative URLs, which would
otherwise redirect a client to another host.

### What the session contract cannot express

Asserted by `packages/contracts/test/session-schema.test.ts`:

`ingress`, `subdomain`, `hostname`, `publicUrl`, `publishedPort`, `hostPort`,
`transcript`, `blocks`, `commands`, `commandText`, `output`, `stdout`,
`stderr`, `history`.

A session is temporary and **never published**: it has no ingress route, no
subdomain, and no long-lived publicly reachable address
([ADR-0012](./adr/0012-sessions-are-not-published.md)).

---

## Versioning

- **Additive** changes (new optional fields) are minor.
- **Removals, renames, and type changes** are breaking and need a new schema
  version plus a migration path.
- A change ships with its regenerated TypeScript, C#, and Go types and its update
  to this document. `contract-drift` CI fails otherwise.

## Related

- [`docs/experience-reference.md`](./experience-reference.md) — the creator contract
- [`docs/adr/0014-framework-free-interaction-core.md`](./adr/0014-framework-free-interaction-core.md)
- [`AGENTS.md`](../AGENTS.md) §4.8 — the interaction model is implemented once