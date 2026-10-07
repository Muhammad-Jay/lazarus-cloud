# TODO

This is the work plan. It is **derived from [`LAZARUS_MODEL.md`](./LAZARUS_MODEL.md)**,
which is the authority on what Lazarus is. Where the two disagree, the model wins and
this file is wrong until it is corrected.

The previous version of this file was a 26-phase control-plane-first plan inherited
from the discarded repository. It is gone deliberately: it built infrastructure
before the product experience, and it assumed a frontend framework and an isolation
technology that `LAZARUS_MODEL.md` §17 explicitly lists as undecided.

Read [`AGENTS.md`](./AGENTS.md) for how to work here, not for what to build.

---

## What Lazarus is, in one paragraph

An interactive documentation and software execution platform. A creator publishes an
*experience*; a user reads the documentation, composes real commands, runs them in a
real isolated environment, and reads real results — in one interface. Documentation
and interaction are one feature. It is not a terminal with docs attached, not an IDE,
not a simulator of output. See `LAZARUS_MODEL.md` §1–§3.

---

## Ordering rule

`LAZARUS_MODEL.md` §16 is the priority order, and it is deliberately
experience-first:

> Development should validate the core product experience before expanding the
> platform into a large collection of infrastructure and creator features.

So the order is: **interaction model → contracts → one real environment → MDX →
creator workflow → multi-user validation.** Control-plane breadth, tenancy
machinery, multi-cloud orchestration and deployment topology come last, because the
model says runtime technology should be *informed by* observed requirements
(§16 Phase 6), not selected in advance (§9.3).

---

## Built so far

| Area | State |
|---|---|
| `packages/spec/lazarus.schema.json` | done — experience contract, 33 tests |
| `packages/contracts/src/schema/interaction.schema.json` | done — 40 tests, including every §5.1 entity |
| `packages/contracts/src/schema/session.schema.json` | done — server-side descriptor only, 31 tests |
| TypeScript codegen (`tools/codegen`) | done — deterministic, idempotent, collapses duplicate interfaces |
| `docs/experience-reference.md`, `docs/contracts-reference.md` | done |
| `contract-drift` CI | done — regeneration + reference-update checks |
| `packages/interaction/` | done — 184 tests: reducer, normalisation, ranking, ANSI filter, id derivation |
| C# and Go contract targets | not built — 2.6 |

Nothing else in the repository is implemented. `apps/web`, `apps/control-plane`,
`services/auth` and `infra` contain placeholder READMEs, and `apps/cli/main.go` is a
build-wiring stub. There is no prior implementation to preserve or work around.

---

## Phase 1 — The interaction core (`@lazarus/interaction`)

The model calls consistency "the central architectural requirement"
(`LAZARUS_MODEL.md` §18). The interaction model is implemented once, framework-free,
importing only `@lazarus/contracts` (§5.1, §9.7, ADR-0014). This package is the
reason a future desktop terminal is a new shell rather than a rewrite.

- [x] **1.1** State shape and a pure `(state, action) => state` reducer. No React,
      no DOM, no fetch, no storage, no timers. Reducer input and output are plain
      values so any client can drive the same transitions.
- [x] **1.2** Execution arrives as an `ExecutionEvent` stream applied to the
      reducer. Output is never read back out of component state.
- [x] **1.3** Transcript normalisation, done **once**, where an `ExecutionEvent`
      becomes a `TranscriptBlock`. Presentation consumes blocks; it never parses raw
      output and never reorders blocks.
- [x] **1.4** Suggestion ranking in the package. A client never ranks (§4.2).
- [x] **1.5** Draft-conflict resolution: a context change replaces an unmodified
      draft and raises `draftConflict` for an edited one. §5.2 leaves the exact
      policy as an interaction design decision — the model permits either; we
      recorded ours in `docs/contracts-reference.md`.
- [x] **1.6** ANSI to colour mapping is a **filter**, not an emulator. Cursor and
      erase semantics are stripped. Never `innerHTML` (ADR-0013).
- [x] **1.7** Table-driven Vitest suite over every action × event pair.

**Accept:** `pnpm -F @lazarus/interaction test` green; the dependency list is
exactly `@lazarus/contracts`; a case exists for each action and each event.

**Done.** `pnpm -F @lazarus/interaction test` — 184 tests across 6 files, 1.4s.
Typecheck clean.

Three decisions recorded in code rather than left implicit:

- **Draft identity.** Block ids are *derived* from the event that produced them
  (`syntheticId`), not random. Reconnection replays events (§8.4), and a random id
  would append a duplicate block on every replay. They are shaped as UUIDs because
  the contract requires it, but stamped with RFC 9562 version `8` so a block id can
  never be mistaken for a server-minted one.
- **Conflict rule.** Unmodified → replaced; modified → raised and **kept**, because
  the alternative loses typing. Recorded in `docs/contracts-reference.md`.
- **Extended ANSI colour is dropped**, not approximated. There is no token for
  "colour 214", so `38;5;n` falls back to `default` rather than inventing one
  (ADR-0018).

Two things the tests caught that would otherwise have shipped:

- `SCORE_CUTOFF` as a threshold did not work. `ls` scored 0.1 and `curl` 0.075
  against the query `zzzz`, so typing nonsense still surfaced two commands.
  "Matched nothing" is now its own answer rather than a low score, and the constant
  is gone.
- `replay` de-duplication, `modified`-draft conflicts, and the ANSI literal-colour
  rule were each verified by mutating the source and confirming a named case fails,
  rather than by trusting a passing suite.

`test/framework-free.test.ts` enforces the leaf rule by reading the source: a React
import, a `localStorage` read, or a `Date.now()` call fails the suite. Verified by
mutation. `test/reducer.test.ts` validates every resulting state against the
authoritative schema, because an explicit `undefined` property is *present* as a key
— `toEqual` ignores it, `additionalProperties: false` rejects it.

---

## Phase 2 — Close the contract gaps (`@lazarus/contracts`, `@lazarus/spec`)

Model §16 Phase 2 requires schemas for *documentation metadata and references*,
*structured output*, and *local session persistence*.

**2.1–2.4 are done.** They were missing because nothing had read the model against
the schema — the old plan did not ask whether the contracts described the product.
Phase 1 was therefore being built against contracts that did not describe it.

- [x] **2.1** `DocumentationRef` — the model lists it as a core interaction entity
      (§5.1) and documentation search drives it (§4.4). Not present in the
      interaction schema today.
- [x] **2.2** Structured / rich output. §4.6 and §10 want expandable sections,
      dropdowns, links, command pills, contextual documentation and interactive
      controls. `RichOutput` is currently ANSI-styled text spans only. Needs a
      validated component protocol with an explicit **fallback to raw text** for
      anything unrecognised (§10.3).
- [x] **2.3** Inline content: add `documentationRef` and interactive controls to the
      existing `inlineText`/`inlineEmphasis`/`inlineCode`/`inlineLink`/`inlineCommand`
      union (§10.2).
- [x] **2.4** Local session persistence record — the browser-side `LocalSession`
      model (§8.1, §8.2). Distinct from `session.schema.json`, which is the
      server-side coordination descriptor (§8.3). Both are needed and they must not
      be conflated.
- [ ] **2.5** Documentation metadata schema (§6.2 — the model marks the exact shape
      as undefined, so this is a decision to make, not to copy).
- [ ] **2.6** Generate C# and Go targets from the same schemas (ADR-0016, §4.6).

**Accept:** every entity in §5.1 has a schema; §16 Phase 2 checklist is fully
covered; golden tests per schema; `contract-drift` covers the new types.

**2.1–2.4 done** (commit `0e0afd4`), 71 tests then 75. 2.5 and 2.6 remain.

The load-bearing decision: **every branch of `StructuredOutput` requires `raw`**,
carrying the text the program actually printed. §4.6 forbids a renderer from
fabricating or silently altering a result, and §10.3 requires unrecognised output
to fall back to plain text — neither is achievable unless the raw text travelled
with the structure. So presentation is layered on top of real output, never a
replacement for it. A fixture fails if `raw` is removed.

A `control` names declared `actionIds` and carries no behaviour, so output can
request an operation the product already knows about but cannot introduce new
behaviour. That is the line between structured output and executable UI.

`LocalSession` is the browser-side record from §8 and is a **separate type** from
the server descriptor — §8.3 says those are three lifecycles. It carries no
`tenantId`, no routing metadata and no credentials, and has fixtures proving all
three are rejected. Its runtime state mirrors the server's vocabulary plus
`unknown`, because §8.4 requires a restored transcript not to imply the runtime is
still alive.

`localSession` and `executionRequest` are unreachable from the schema root, so
nothing would have validated them. The harness gained a suite that compiles a
`$def` directly, which is what makes those rejections real rather than decorative.

---

## Phase 3 — Design tokens (`@lazarus/tokens`)

§15.7 calls premium, deliberate presentation part of usability rather than
decoration, and §4.6 keeps rich rendering on semantic roles. Tokens are the single
source of every colour, spacing, radius, shadow and motion value; raw values outside
this package are a build failure (ADR-0018).

- [x] **3.1** Single source of tokens; generate the CSS custom properties and the TS
      types from it. Nothing imports anything — it is a leaf.
- [x] **3.2** Every `ColorRole` in the interaction schema resolves to a token.

---

## Phase 4 — The interactive experience prototype (model Phase 1)

Model §16 Phase 1: build the main interface and validate the interaction model with
**mock execution data**. The stated objective is to validate the central interaction
model, not to simulate a complete execution platform.

Validate: command editor behaviour · contextual suggestions · subcommand selection ·
command pills · documentation search · hover documentation and popovers · structured
transcript rendering · context changes and command-draft behaviour · visual hierarchy
and responsiveness.

- [x] **4.1** Frontend framework selection — Next.js 16 (per repo constraints; conflict noted in Open decisions remains until reconciled). — **undecided**, see Open decisions. Pick
      it against the requirements in §9.7, not by assumption.
- [ ] **4.2** CodeMirror-based command editor with the custom behaviour §4.1
      describes: free-form editing, subcommand discovery, history, contextual
      references. It must stay a genuine text editor (§4.1).
- [ ] **4.3** Command palette and contextual menus (§4.2), command pills (§4.3),
      documentation search (§4.4), hover popovers (§4.5).
- [ ] **4.4** Structured transcript renderer consuming `TranscriptBlock` only.
- [ ] **4.5** Mock execution adapter — a **development fixture**, clearly marked,
      feeding the real event contract. It is not the product fabricating output:
      §1 requires real execution, and only §16 Phase 1 sanctions mock data for
      prototyping. It must be impossible to ship in a production path.
- [ ] **4.6** Component responsibilities per the §5.4 table.

**Accept:** the nine §16 Phase 1 behaviours demonstrably work against the mock
adapter, driven through `@lazarus/interaction`.

---

## Phase 5 — One real execution environment (model Phase 3)

Session creation · command execution · streaming stdout and stderr · execution status
· cancellation · reconnection · runtime expiration · local history restoration.

A Git-related workflow is the model's suggested end-to-end scenario because it
exercises command composition, filesystem operations, documentation and real
execution.

- [ ] **5.1** Choose the isolation technology *by evaluating* §9.3's requirements,
      which §9.3 and §16 Phase 6 both require before selection.
- [ ] **5.2** Runtime adapter behind an abstraction (§9.3) — the control plane must
      not be coupled to one isolation technology.
- [ ] **5.3** Dedicated execution path / gateway. §9.2: the control plane must not be
      the hot path for high-volume output streaming.
- [ ] **5.4** Prepared image + temporary writable session layer (§7.2).
- [ ] **5.5** Reconnection and expiration, keeping §8.3's three lifecycles distinct.

---

## Phase 6 — MDX-driven assistance (model Phase 4)

One documentation source feeding search results, contextual explanations, command
references, task suggestions, command pills, and full rendering (§6.1, §16 Phase 4).

- [ ] **6.1** Parse and validate MDX at publish time; allow-listed components only;
      no path from a document to `eval` (ADR-0017, §6.4, §13).
- [ ] **6.2** Build searchable content and extract command/concept references (§6.1).
- [ ] **6.3** Drive interaction entities from documentation (§6.3) without letting
      documentation become an alternate source of runtime permission (§6.2).

---

## Phase 7 — Creator workflow (model Phase 5)

Environment definitions · dependency preparation · sample projects and data · image
building and publishing · versioning · interaction configuration · resource policies.

---

## Phase 8 — Multi-user and deployment validation (model Phase 6)

Runtime isolation · session concurrency · startup latency · resource usage · output
streaming · cleanup · authentication · self-hosted requirements · hosted behaviour.

This is where runtime and deployment decisions get made from evidence (§16 Phase 6).

---

## Open decisions

`LAZARUS_MODEL.md` §17 says these are not settled and must stay explicit rather than
being presented as settled architecture. Each is listed here with its current state,
so it is visible rather than quietly decided.

| Decision | State in the model | State in this repo | Action |
|---|---|---|---|
| Frontend framework | not finalised (§9.7, §17) | `AGENTS.md` + docs assert **Next.js 16** | **Conflict.** Decide against §9.7 requirements, then realign the docs. |
| Runtime / isolation technology | must be evaluated before selection (§9.3, §16 Phase 6) | `AGENTS.md` asserts **rootless podman** | **Conflict.** Same. |
| Execution gateway boundaries | open (§9.2, §17) | docs put streaming on the .NET control plane | **Conflict.** §9.2 forbids the control plane being the streaming hot path. |
| Structured output protocol | open (§17) | **Decided** — every branch carries `raw` | Phase 2.2. Closed. |
| Draft-conflict policy | either is permitted (§5.2) | **Decided** — modified draft wins | Phase 1.5. Recorded in `docs/contracts-reference.md`. |
| MDX metadata / component schema | open (§6.2, §17) | not started | Phase 2.5. |
| Creator configuration format | open (§11, §17) | experience schema drafted | Phase 7. |
| Command suggestion strategy | open (§17) | **Decided** — deterministic, in-package | Phase 1.4. Command *parsing* still open, Phase 4.2. |
| Local session record | open (§17) | **Decided** — `LocalSession`, browser-side | Phase 2.4. Closed. |
| Local retention and storage limits | open (§8.5, §17) | record exists; **limits not chosen** | Phase 4.5. |
| Reconnection replay | open (§8.4, §17) | **Decided** — derived block ids, idempotent replay | Phase 1.1. Expiration still open, Phase 5.5. |
| Deployment topology | open (§12, §17) | compose files assume a shape | Phase 8. |
| Desktop application architecture | open (§17) | `apps/desktop` assumed Tauri | After the first product. |

---

## Conflicts to resolve

Three places where the current docs assert something `LAZARUS_MODEL.md` says is
undecided. They are listed rather than silently reconciled, because resolving them
means choosing, and choosing is the owner's call.

1. **`AGENTS.md` §1–§2, `README.md`, `docs/architecture.md` name Next.js 16.**
   The model says the framework has not been finalised and should be chosen from
   product requirements (§9.7). Fixing the docs to say "undecided" is the honest
   move; picking a framework is a decision, not documentation.
2. **Rootless podman is asserted as the runtime.** §9.3 requires evaluating
   non-root execution, resource limits, restricted host access, network policy,
   process isolation and reliable cleanup — and notes a shared-kernel container
   alone may not satisfy the threat model for public workloads.
3. **A .NET control plane doing SignalR streaming end to end.** §9.2 wants a
   dedicated execution path and says the control plane must not become the hot path
   for high-volume output.

Also open: model Phase 1 explicitly permits **mock execution data** for prototype
validation, while §1 forbids simulating output in the product. Phase 4.5 treats this
as resolvable — a marked development fixture that cannot ship — but the distinction
should be confirmed rather than assumed.

---

## Explicitly not doing

From `LAZARUS_MODEL.md` §3, and never regardless of phase ordering:

- A browser terminal emulator with a documentation sidebar
- A full IDE or browser development environment
- A long-lived cloud development workspace
- A generic code playground for arbitrary projects
- A static documentation generator, or docs that merely embed terminal examples
- A terminal simulator that fabricates command output
- A graph/node/flow editor of any kind
- A PTY

And the future general-purpose desktop terminal (§2.2) is **not** first-product
scope; the model only requires that its shared interaction model stay reusable.