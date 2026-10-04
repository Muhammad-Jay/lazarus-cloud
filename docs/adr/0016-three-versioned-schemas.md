# 0016 — Three versioned schemas, one codegen target set

**Status:** Accepted
**Date:** 2026-10-04

**Supersedes:** [0007](./0007-spec-schema-as-sole-contract.md)

## Context

ADR 0007 decided that one JSON Schema is the sole contract, and that everything is
generated from it. That discipline is the reason this repository can change a
contract and know the build fails if a target was missed. The decision is kept.

What changed is the *number* of contracts. The old product had one: the spec
describing what to build and deploy. The new product has three genuinely different
descriptions, owned by different parties and versioned at different rates:

1. **The experience** — authored by a *creator*, validated at publish time.
   Documentation, environment definition, command metadata, policies. This stays
   `packages/spec/lazarus.schema.json` and is still called "the spec" informally.
2. **Interaction** — authored by *us*, sent between our own components. State
   shapes, execution events, transcript blocks, suggestions.
3. **Session** — authored by *us*, describes a live session and how to reattach
   to it. Descriptors, TTL, reconnection.

Merging them into one schema would be wrong on two counts. The interaction and
session contracts change with every release of the product; the experience
contract must stay stable so creators' published work keeps working. Coupling them
means an internal refactor is a breaking change to published content.

The encoding question is separate. `lazarus.yaml` is what a human writes.
`lazarus.json` is what an AI agent or any other software posts. They are **the
same schema in two encodings** — there is never a `lazarus.json` whose shape the
YAML encoding cannot express.

## Decision

**There are three authoritative versioned JSON Schemas, and every generated type in
every language comes from one of them. This supersedes ADR 0007.**

| Schema | Owner | Path | Changes when |
|---|---|---|---|
| Experience | creators publish it | `packages/spec/lazarus.schema.json` | We add a contract field |
| Interaction | we own it | `packages/contracts/src/schema/interaction.schema.json` | The product's behaviour changes |
| Session | we own it | `packages/contracts/src/schema/session.schema.json` | Session lifecycle changes |

- **Never hand-edit a generated type** in C#, TypeScript, or Go. Change the
  schema, regenerate, commit every target in the same change.
- A schema change ships with its regeneration **and** its reference-doc update
  (`docs/experience-reference.md` or `docs/contracts-reference.md`). A schema
  change without regeneration fails `contract-drift` CI.
- **Additive changes** (new optional fields) are minor. **Removals, renames, and
  type changes** are breaking: they require a new schema `apiVersion` and a
  documented migration path for existing experiences.
- `lazarus.yaml` and `lazarus.json` are one schema in two encodings. `lazarus.json`
  exists for programmatic callers, not as a second contract.

## Consequences

### Positive

- Internal refactors are not breaking changes to published creator content.
- `contract-drift` CI can be precise: each schema has its own targets and its own
  reference doc.
- A creator's experience has a stability guarantee that a product release cannot
  quietly remove.
- Generated types are still, unambiguously, generated. One mechanism, three
  inputs.

### Negative

- Three schemas means three version lines and three reference docs. That is real
  maintenance, and it is the cost of not coupling published content to release
  cadence.
- Code generation has three entry points instead of one, so a generator bug must
  be fixed in three places or refactored to handle all three.
- Cross-schema references (an interaction type referenced by a session type) need
  an explicit `$ref` strategy rather than one self-contained file.

### Neutral

- The informal name "the spec" still refers to the experience schema. That is a
  vocabulary habit, not a second contract.

## Alternatives considered

**One schema with nested sections for experience, interaction, and session.**
Rejected: couples release cadence to published content, and a creator-facing
breaking change would then be forced on us by an internal refactor.

**Experience schema only; hand-write the interaction and session types.**
Rejected: hand-written wire types drift from each other across languages. The
previous implementation had exactly this problem, in two Node backends.

**Generate C# and TypeScript but write Go types by hand.** Rejected: the CLI needs
to parse the same contract, and a hand-written Go type is a third
implementation of the same schema.

**Treat `lazarus.json` as a distinct schema with its own conveniences.** Rejected:
it immediately becomes a second contract with its own drift, and the YAML form
would be unable to express something real callers rely on.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §4.6 — the contract is the contract
- [`0007-spec-schema-as-sole-contract.md`](./0007-spec-schema-as-sole-contract.md)
- [`../experience-reference.md`](../experience-reference.md)
- [`../contracts-reference.md`](../contracts-reference.md)
