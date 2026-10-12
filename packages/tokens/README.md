# `@lazarus/tokens`

The single source of every colour, spacing, radius, shadow and motion value. It is
a leaf package: it imports nothing, and nothing imports another package's `src/`.

## Principle

Raw values live only in `src/tokens.json`. That JSON is the single source of truth.
The generator (`tools/codegen/generate-tokens.mjs`) produces
`src/generated/tokens.css` (CSS custom properties, with `.dark` overrides) and
`src/generated/tokens.ts` (typed, `as const` tables). Both generated files are
committed.

`ColorRole` is generated from the interaction schema enum. The test suite guarantees
the role table matches `packages/contracts/src/schema/interaction.schema.json#/$defs/colorRole.enum`
exactly.

## Exports

- `@lazarus/tokens` — TypeScript surface from `src/index.ts` (pure re-exports)
- `@lazarus/tokens/css` — `src/generated/tokens.css`
- `@lazarus/tokens/tokens.json` — the source JSON

## Mapping to VTN-Lab reference

This package ports the semantic tokens from `packages/tailwind-config/tokens.css`.
Surfaces use role-named semantics (page/section/control/raised/overlay/tooltip) per
`ADR-0018` (role names rather than order names). Spacing, motion, and z-index were
added because they appear in the reference's consumers and must come from tokens.

## See also

- `docs/adr/0018-semantic-tokens-only.md`
- `TODO.md` Phase 3
- `packages/interaction/src/ansi.ts` (uses ColorRole)
- `tools/codegen/generate-tokens.mjs`
