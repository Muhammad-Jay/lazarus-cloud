# packages/contracts

**Generated. Never hand-edited.** (`AGENTS.md` §4.7)

> **Status: not yet written.** Lands in Phase 15 (`TODO.md` 15.4–15.5).

## What will be here

| Output | Generated from | Phase |
|---|---|---|
| `hub-manifest.json` | C# SignalR hub interfaces | 15.4 |
| `hub-types.ts` | `hub-manifest.json` | 15.5 |
| `api-client/` | OpenAPI from the .NET host | 16.2 |

## Why a separate directory

These files have one property the rest of the TypeScript does not: **nobody may
edit them.** Mixing generated and hand-written code in a package makes it
unknowable which is which, and the wrong answer is always "just this one small
fix".

`.gitattributes` marks the tree `linguist-generated`, so a reviewer reads the
source of truth — the C# hub interfaces and the OpenAPI document — and skips the
output.

## The rule

An edit here is lost on the next `just codegen`. The `contract-drift` CI job
regenerates and fails on any diff, so hand edits cannot survive a push anyway.

If the generated shape is wrong, the source is wrong. Fix the source.

## Related

- [`../../tools/codegen/README.md`](../../tools/codegen/README.md) — codegen rules
- [`../../docs/adr/0007-spec-schema-as-sole-contract.md`](../../docs/adr/0007-spec-schema-as-sole-contract.md)
- [`../spec/README.md`](../spec/README.md) — the spec contract