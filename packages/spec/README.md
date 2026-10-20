# packages/spec

**The experience contract.** `lazarus.schema.json` lives here and is the sole source of truth for
the `lazarus.yaml` format.

| File                             | Purpose                                              |
| -------------------------------- | ---------------------------------------------------- |
| `lazarus.schema.json`            | JSON Schema draft 2020-12. Authoritative.            |
| `src/generated/experience.ts`    | Generated TypeScript types. Never edited.            |
| `src/index.ts`                   | Public surface.                                      |
| `test/experience-schema.test.ts` | Golden-file and negative-fixture suite.              |
| `test/fixtures/`                 | Valid documents plus a table of expected rejections. |

`@lazarus/spec` is a leaf: it imports nothing. It is not a copy of the contract — it is the
contract's type projection and its test suite.

## Rules

- **The schema is the only place a spec field is defined.** Not here in a type, not in C#, not in
  Go. Every target is generated from this one file.
- **Never hand-edit anything under `src/generated/`.** An edit is lost on the next run (`AGENTS.md`
  §4.7). Fix the generator in `tools/codegen`.
- **The schema is also a security boundary.** There is no field for privileged mode, host mounts,
  host networking, `docker.sock`, added capabilities, host namespaces, or published ports — because
  they are unexpressible, they cannot be requested. Adding one is a security change and needs an
  ADR.
- **`description` fields carry the prose**, which is why the reference can be derived from the
  schema instead of drifting from it.
- **Golden-file tests.** Every valid fixture must parse to an expected model. A fixture that stops
  parsing fails the build, and every invalid fixture asserts the Ajv keyword, the instance path, and
  the exact `missingProperty`.

## Testing

Ajv compiles the schema with `strict: true` and `allErrors: true`, and `$ref` resolution is manual —
a broken `$ref` is a missing function, not a silent no-schema. `useDefaults` is on so fixtures can
exercise defaults.

The negative cases are the point of the suite. Removing a `required`, loosening a pattern, or adding
a forbidden property must each break a test.

## Versioning

| Change                             | Bump     | `apiVersion` |
| ---------------------------------- | -------- | ------------ |
| New optional field                 | minor    | unchanged    |
| Field removed, renamed, or retyped | breaking | **new**      |
| Validation bug fix                 | patch    | unchanged    |

A breaking change requires a new `apiVersion`, a migration path, and an ADR
([`ADR-0016`](../../docs/adr/0016-three-versioned-schemas.md)).

## Related

- [`docs/experience-reference.md`](../../docs/experience-reference.md) — the reference this
  implements
- [`../contracts/README.md`](../contracts/README.md) — the interaction and session contracts
- [`../../tools/codegen/README.md`](../../tools/codegen/README.md) — how generation works
- [`ADR-0016`](../../docs/adr/0016-three-versioned-schemas.md)
- [`ADR-0017`](../../docs/adr/0017-untrusted-creator-content.md)
