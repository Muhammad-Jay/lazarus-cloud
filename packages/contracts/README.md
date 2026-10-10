# packages/contracts

**The interaction and session contracts.** Two JSON Schemas, the TypeScript types
generated from them, and the tests that hold them.

| File | Purpose |
|---|---|
| `src/schema/interaction.schema.json` | Workspace context, draft, suggestions, actions, transcript, execution events. Authoritative. |
| `src/schema/session.schema.json` | Session descriptor, limits, reconnection ticket, lifecycle events. Authoritative. |
| `src/generated/interaction.ts` | Generated. Never edited. |
| `src/generated/session.ts` | Generated. Never edited. |
| `src/index.ts` | Public surface. Re-exports the generated types. |
| `test/` | Golden files and negative fixtures for both schemas. |

This package is a **leaf**: it imports nothing at all
(`AGENTS.md` §4.7). Every type is re-exported from the package root, so no
consumer ever imports another package's `src/`.

The interaction and session contracts version **independently** of each other and
of the experience contract, so an internal refactor is never a breaking change to
published creator content.

## Rules

- **Never hand-edit anything under `src/generated/`.** An edit is lost on the next
  run and `contract-drift` CI fails on any diff.
- **The schemas are hand-authored and are the source of truth.** Only
  `src/generated/` is marked `linguist-generated` in `.gitattributes`, precisely so
  an authored contract change stays visible in review.
- **If the generated shape is wrong, the schema is wrong** (or the generator is).
  Fix the source, then regenerate.
- **These schemas are a boundary, not a description.** They carry no transcript
  payload and no published session address, because a session has neither.

## What the tests assert

Beyond the golden files, both suites scan the schema for concepts the product does
not have. `interaction-schema.test.ts` rejects `pty`, `terminalFrame`,
`cursorPosition`, `screen`, `scrollback`, `rows`, `cols`, `shell`, and any literal
colour — a hex value, `rgb(`, or `hsl(`. `session-schema.test.ts` rejects
`ingress`, `subdomain`, `hostname`, `publicUrl`, `publishedPort`, `transcript`,
`blocks`, `commands`, `commandText`, `output`, and `history`.

Adding one of those concepts is a product change, not a schema typo. It needs an
ADR before it can be added, which is the reason the assertions are tests.

## Testing

Fixture loading is duplicated from `@lazarus/spec` on purpose. `packages/spec`
imports nothing, so it cannot share a harness with `packages/contracts` without one
of the two acquiring a dependency the other may not have. The suite asserts that
constraint rather than working around it.

Negative fixtures assert the Ajv keyword, the instance path, and the exact
`missingProperty`, so a loosened `required` cannot pass by changing the error
count.

## Related

- [`docs/contracts-reference.md`](../../docs/contracts-reference.md) — the reference this implements
- [`../spec/README.md`](../spec/README.md) — the experience contract
- [`../../tools/codegen/README.md`](../../tools/codegen/README.md) — codegen rules
- [`ADR-0014`](../../docs/adr/0014-framework-free-interaction-core.md)
- [`ADR-0016`](../../docs/adr/0016-three-versioned-schemas.md)
