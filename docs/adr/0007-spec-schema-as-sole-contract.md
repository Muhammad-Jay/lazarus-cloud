# 0007 — The spec schema is the sole contract

**Status:** Accepted
**Date:** 2026-10-02

## Context

A spec like this:

```yaml
apiVersion: lazarus.dev/v1
service: my-api
image: ghcr.io/acme/my-api@sha256:abc123
build:
  context: .
  dockerfile: Dockerfile
ports:
  - container: 8080
    subdomain: api
resources:
  memory: 512Mi
  cpus: 1
env:
  - name: DATABASE_URL
    secret: my-db-url
```

is read by three runtimes: the .NET control plane, the TypeScript dashboard, and the
Go CLI. Each needs a typed representation, and each has its own type system with
its own ideas about optionality, enums, and nullability.

That is three implementations of the same shape, and they will drift. Not
dramatically — a field gets added to the .NET type and not the Go one, and the CLI
silently drops it. Nothing fails. It surfaces later as a bug report that says the
CLI ignores a setting.

The previous implementation's failure mode was exactly this: two Node backends with
hand-maintained spec types that disagreed.

There is a second, more dangerous drift: **validation**. If the TypeScript validator
accepts a spec the C# runtime rejects, the user gets a green checkmark in the
dashboard and then a failed deployment. That is a trust problem, not just an
annoyance.

## Decision

`packages/spec/lazarus.schema.json` is **authoritative and the sole source of truth**
for the spec format. It is JSON Schema draft 2020-12.

- **One schema generates all three type sets**: TypeScript, C#, and Go. No
  hand-written types, no hand-maintained copies, no "temporary" parallel definitions.
- **Generated output is committed**, marked `linguist-generated`, and **never hand
  edited**. An edit is lost on the next run; fix the generator (`AGENTS.md` §4.7).
- **`contract-drift` is a required CI check.** It regenerates and fails on any diff
  against committed output. This is what makes the rule enforceable rather than
  aspirational.
- **A schema change ships with its regeneration and its documentation in the same
  PR.** A schema change without regeneration fails CI.
- **The schema is also the security boundary.** There is no field for privileged
  mode, host mounts, host networking, `docker.sock`, added capabilities, or host
  namespaces. They are unexpressible, so they cannot be requested
  (`ADR-0010`).
- **Validation lives in exactly one runtime per call site.** The dashboard
  validates for feedback; the control plane validates for enforcement. They share
  the schema, not the code, because they run in different languages.
- **The CLI does not re-implement policy or validation.** It presents the schema and
  calls the API.

Versioning:

| Change | Bump | `apiVersion` |
|---|---|---|
| New optional field | minor | unchanged |
| Field removed, renamed, or retyped | minor | **new** |
| Bug fix in validation wording | patch | unchanged |

A breaking change requires a new `apiVersion`, a documented migration path, and an
ADR.

## Consequences

### Positive

- **Structurally impossible to drift.** You cannot have three disagreeing
  definitions of "what a port means" when two of them are generated from the third.
- **The trust problem is fixed.** All three runtimes derive validation from one
  schema, so a spec that validates in the dashboard validates in the runtime.
- **Adding a field is mechanical.** Change the schema, run `just codegen`, commit
  three files. No hunting for every type that mentions a field.
- **The schema is reviewable.** A security reviewer reads one JSON document to know
  what a user can ask for. That is only true because there is exactly one.
- **Documentation is derivable.** `docs/spec-reference.md` is generated from the
  schema, so it cannot document a field that does not exist.

### Negative

- **Codegen is infrastructure to maintain.** A generator breaks, and it blocks every
  schema change until fixed.
- **Generated code lands in the diff.** Reviews see generated files, which is noise.
  Mitigated by `linguist-generated` and by reviewing the schema instead.
- **Schema-first is slower for small changes.** Adding one field is three
  regenerated files plus a schema change, where a hand-written type would be one
  line in one file. This is the intended trade.
- **JSON Schema cannot express everything.** Cross-field invariants — "if
  `build` is present then `image` must not be" — need `if`/`then` in the schema,
  which are harder to read than a code-level check. Accepted; expressiveness in one
  place beats a check in three.
- **Version skew exists during rollout.** An old control plane meeting a new spec
  must reject rather than mis-handle it. Rejection is the designed behaviour.

### Neutral

- The control plane validates again on receipt even if the dashboard already did.
  Client-side validation is feedback; server-side validation is enforcement.
- The schema is JSON Schema 2020-12 rather than CUE or TypeBox, for ecosystem
  support across three languages.

## Alternatives considered

**Hand-written types in each language.** Rejected: this is the default and it is
what drifted before. Three definitions of one shape, no mechanism to detect
disagreement, and no single place a reviewer can audit what a user can express.

**Generate C# only, hand-write the rest.** Rejected: this keeps exactly the drift we
are eliminating, just with less code to compare.

**A protobuf or OpenAPI-style IDL instead of JSON Schema.** Rejected: JSON Schema is
the lingua franca for YAML config, editors, and validation tooling across all three
languages, and it is what users can read. A protobuf message is not something a user
can put in a `lazarus.yaml`.

**TypeBox or JSON Schema as the single source, with a TS-first toolchain.** Close
second. Rejected because TS-first makes the .NET generator a downstream consumer and
pushes C# types toward being generated from TypeScript types, which inverts the
dependency for the component that actually enforces.

**One runtime owns the spec and the others call it.** Rejected: the CLI needs to
parse a spec offline to give feedback before creating anything, and shipping the
whole control plane for `lazarus validate` is not acceptable.

**Validate only at the API boundary, never in the UI.** Rejected: then the dashboard
gives no feedback until submission, and the user learns about a typo from a failed
deployment.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §4.6 — the spec is the contract
- [`../../AGENTS.md`](../../AGENTS.md) §4.7 — generated code is generated
- [`../../tools/codegen/README.md`](../../tools/codegen/README.md) — codegen rules
- [`0010`](./0010-policy-as-mandatory-chokepoint.md) — the schema as a security boundary
- [`../architecture.md`](../architecture.md) — the spec as contract