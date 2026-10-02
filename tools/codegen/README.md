# tools/codegen

Code generation from the contracts. Nothing here is hand-written output.

## What gets generated, from what

| Output | Source of truth | Phase |
|---|---|---|
| `packages/spec/generated/*.ts` + validator | `packages/spec/lazarus.schema.json` | 2.4 |
| `Lazarus.Modules.Specs` generated types (C#) | `packages/spec/lazarus.schema.json` | 2.5 |
| `apps/cli` spec types (Go) | `packages/spec/lazarus.schema.json` | 2.5 |
| `packages/api-client` | OpenAPI from the .NET host | 16.2 |
| `packages/contracts/hub-manifest.json` | C# SignalR hub interfaces | 15.4 |
| `packages/contracts` hub types (TS) | checked against `hub-manifest.json` | 15.5 |

## The rule

Generated output is committed, never hand-edited. An edit is lost on the next
run — fix the generator instead (`AGENTS.md` §4.7).

Committing generated output is deliberate: CI regenerates and diffs, so drift
fails the build. Generated files are marked `linguist-generated` in
`.gitattributes` so they do not pollute diffs and language statistics.

## Drift detection

`contract-drift` is a required CI check. It regenerates everything and fails on
any diff against committed output.

This is what makes "the spec is the contract" (`AGENTS.md` §4.6) enforceable
rather than aspirational: change the schema without regenerating, and the build
breaks.

## Regenerate

```sh
just codegen
```

Must be idempotent. Running it twice with no input change produces no diff.

## Adding a generator

- Deterministic output. No timestamps, no random ordering, no absolute paths.
- Sort collections before emitting them.
- Fail loudly on an unknown input rather than emitting something plausible.
- The generator gets its own tests, run in CI.