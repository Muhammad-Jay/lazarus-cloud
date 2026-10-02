# packages/spec

**The contract.** `lazarus.schema.json` lives here and it is the sole source of
truth for the `lazarus.yaml` format.

> **Status: not yet written.** The schema lands in Phase 2 (`TODO.md` 2.1). This file
> describes what will be here and the rules it must obey.

## What will be here

| File | Purpose |
|---|---|
| `lazarus.schema.json` | JSON Schema draft 2020-12. Authoritative. |
| `src/generated/types.ts` | Generated TypeScript types |
| `src/generated/validator.ts` | Generated validator |
| `src/index.ts` | Public surface |

## Rules

- **The schema is the only place a spec field is defined.** Not here in a type, not
  in C#, not in Go. All three runtimes are generated from this one file.
- **Never hand-edit anything under `generated/`.** An edit is lost on the next run
  (`AGENTS.md` §4.7). Fix the generator in `tools/codegen`.
- **The schema is also a security boundary.** There is no field for privileged mode,
  host mounts, host networking, `docker.sock`, added capabilities, or host
  namespaces — because they are unexpressible, they cannot be requested. Adding one
  is a security change and needs an ADR.
- **`description` fields carry the prose.** `docs/spec-reference.md` is generated
  from them, which is why the reference cannot drift from the schema.
- **Golden-file tests.** Every fixture must parse to an expected model, and a
  fixture that stops parsing fails the build.

## Versioning

| Change | Bump | `apiVersion` |
|---|---|---|
| New optional field | minor | unchanged |
| Field removed, renamed, or retyped | minor | **new** |
| Validation bug fix | patch | unchanged |

A breaking change requires a new `apiVersion`, a migration path, and an ADR
(`ADR-0007`).

## Related

- [`../../docs/adr/0007-spec-schema-as-sole-contract.md`](../../docs/adr/0007-spec-schema-as-sole-contract.md)
- [`../../docs/adr/0010-policy-as-mandatory-chokepoint.md`](../../docs/adr/0010-policy-as-mandatory-chokepoint.md)
- [`../../docs/spec-reference.md`](../../docs/spec-reference.md) — generated reference
- [`../codegen/README.md`](../../tools/codegen/README.md) — how generation works