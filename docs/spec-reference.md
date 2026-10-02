# Spec reference

Reference for the `lazarus.yaml` format.

> **Status: not yet written.** This document is generated from
> `packages/spec/lazarus.schema.json`, which does not exist yet. It lands in
> Phase 2 (`TODO.md` 2.7).
>
> Until then, [`TODO.md` §2](../TODO.md) is the authoritative statement of the
> schema's intended shape. Nothing here should be treated as spec behaviour.

## Why this file will be generated

The schema is the sole contract (`ADR-0007`). A hand-written reference document
describes a schema that has already changed, and readers cannot tell which of the
two is wrong.

So the generator produces this file from the schema, and the schema's `description`
fields carry the prose. A field's documentation lives with its definition, which
means it cannot drift from it.

## What it will contain

| Section | Source |
|---|---|
| `apiVersion` | Required field |
| `service` | Required field |
| `image` | Allowlist + digest pinning constraints |
| `build` | Build context, Dockerfile, build args |
| `ports` | Container port, subdomain, protocol |
| `resources` | Memory, CPU, PID limits — all bounded |
| `env` | Names and secret references, never values |
| `healthcheck` | Probe definition |
| `replicas` | Count and rollout strategy |

## Fields that will not be documented here

The spec has **no field** for privileged mode, host mounts, host networking,
`docker.sock`, added capabilities, or host namespaces.

They are not omitted from this document as an oversight. They are unexpressible in
the schema, so there is nothing to document and no request that can ask for them.
See [`ADR-0010`](./adr/0010-policy-as-mandatory-chokepoint.md).

## Related

- [`packages/spec/`](../packages/spec/) — the schema, once it exists
- [`ADR-0007`](./adr/0007-spec-schema-as-sole-contract.md) — the schema is the sole contract
- [`ADR-0010`](./adr/0010-policy-as-mandatory-chokepoint.md) — the schema as a security boundary
- [`../AGENTS.md` §4.6](../AGENTS.md) — schema change rules