# tools/codegen

Code generation from the contracts. Nothing here is hand-written output.

## What gets generated, from what

Three schemas, one generator for TypeScript today. C# and Go targets are
required by `AGENTS.md` §4.6 and are **not built yet** — they are listed here so
the gap is visible rather than implied.

| Output | Source of truth | Status |
|---|---|---|
| `packages/spec/src/generated/experience.ts` | `packages/spec/lazarus.schema.json` | done |
| `packages/contracts/src/generated/interaction.ts` | `packages/contracts/src/schema/interaction.schema.json` | done |
| `packages/contracts/src/generated/session.ts` | `packages/contracts/src/schema/session.schema.json` | done |
| `Lazarus.Contracts` (C#) | all three schemas | not built |
| Go spec types in `apps/cli` | `packages/spec/lazarus.schema.json` | not built |
| `packages/api-client` | OpenAPI from the .NET host | not built |

`generate-types.mjs` is the only generator. It walks each schema and emits one
TypeScript module per schema into `packages/spec/src/generated/` and
`packages/contracts/src/generated/`.

## The rule

Generated output is committed, never hand-edited. An edit is lost on the next
run — fix the generator instead (`AGENTS.md` §4.7).

Committing generated output is deliberate: CI regenerates and diffs, so drift
fails the build. Generated files are marked `linguist-generated` in
`.gitattributes` so they do not pollute diffs and language statistics.

## Drift detection

`contract-drift` is a required CI check. It has three jobs:

| Job | Fails when |
|---|---|
| `Detect schemas` | fewer than all three schemas exist |
| `No drift from the schemas` | regeneration changes committed output, or a second run differs |
| `A schema change ships with its reference-doc update` | a schema changed and neither reference doc did |

That last job is the weakest of the three and is honest about it. The reference
docs are hand-written prose derived from the schemas, not generated from them, so
CI cannot prove they are accurate. What it can prove is that they were *touched*
in the same change, which is the rule `AGENTS.md` §4.6 actually states. Accuracy
is a review responsibility.

This is what makes "the spec is the contract" (`AGENTS.md` §4.6) enforceable
rather than aspirational: change a schema without regenerating, and the build
breaks.

## Regenerate

```sh
just codegen    # or: pnpm codegen
```

Must be idempotent. Running it twice with no input change produces no diff.
`contract-drift` verifies this on a clean checkout, so an ordering-dependent or
timestamp-dependent generator fails CI rather than producing a diff nobody
notices.

## Adding a generator

- Deterministic output. No timestamps, no random ordering, no absolute paths.
- Sort collections before emitting them.
- Fail loudly on an unknown input rather than emitting something plausible.
- The generator gets its own tests, run in CI.