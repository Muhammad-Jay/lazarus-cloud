# Experience contract reference

The experience contract is what a creator publishes. It is authoritative in
[`packages/spec/lazarus.schema.json`](../packages/spec/lazarus.schema.json) and
nothing else describes it.

- **Authoring file**: `lazarus.yaml` (canonical) or `lazarus.json`.
- **One schema, two encodings.** The two forms are the same contract. There is
  never a `lazarus.json` whose shape the YAML encoding cannot express.
- **Generated types**: `@lazarus/spec`, from `pnpm codegen`. Never hand-edited.
- **Why JSON exists**: AI agents and CI callers post JSON. It is not a second
  contract.

Validation happens against the JSON Schema, so a document is either valid or it
was never published. There is no partial acceptance and no "warnings" state.

---

## Top level

`additionalProperties` is `false` everywhere, so an unknown field is an error
rather than something silently ignored.

| Field | Required | Notes |
|---|---|---|
| `apiVersion` | yes | `^lazarus\.dev/v[0-9]+$`. Breaking schema changes require a new value. |
| `title` | yes | 1–120 chars. |
| `description` | no | ≤500 chars, plain text, no markup. |
| `tags` | no | ≤16 labels of ≤40 chars. Discovery only — never used for authorisation. |
| `environment` | yes | The prepared image a session runs against. |
| `documentation` | no | 1–200 documents. |
| `commands` | no | ≤500 documented commands. |
| `tasks` | no | ≤200 multi-step exercises. |
| `secrets` | no | ≤50 references **by name**, never values. |
| `policies` | no | ≤50 entries, **tightening only**. |

---

## `environment`

The prepared software environment. A session runs this image plus a temporary
writable session layer.

| Field | Required | Notes |
|---|---|---|
| `image` | yes | Digest-pinned: `^[^\\s@]+@sha256:[0-9a-f]{64}$`. **A tag is not an identity**, so a tag alone is invalid. |
| `workdir` | no | Relative only. `..` and absolute paths are rejected at validation, so a manifest cannot skip the containment check. |
| `env` | no | ≤64 non-secret variables. Names must match `^[A-Z_][A-Z0-9_]*$`. |
| `resources` | no | See below. |
| `network` | no | Egress only. |

### `environment.resources`

Every bound is **required**. An omitted bound must fail rather than mean
unbounded — that is the whole point of requiring them.

| Field | Required | Range |
|---|---|---|
| `memoryMb` | yes | bounded by `minimum`/`maximum` |
| `cpus` | yes | bounded |
| `pids` | yes | bounded |
| `timeoutSeconds` | no | bounded |

### `environment.network`

A session has **no ingress route at all** ([ADR-0012](./adr/0012-sessions-are-not-published.md)),
so only egress is expressible.

| Field | Default when absent |
|---|---|
| `egress` | deny all outbound |
| `dns` | the platform default |

---

## `documentation`

An ordered list of documents. Each is validated at **publish time** against the
component allow-list ([ADR-0017](./adr/0017-untrusted-creator-content.md)). A
document that fails validation is never published.

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique in the experience. |
| `title` | yes | |
| `summary` | no | |
| `mdx` | no | ≤256 KiB, restricted MDX subset. |

The MDX subset is prose, headings, code, and allow-listed components with typed
string and number props. Creator `import`, `export`, expressions, `{/* */}`
evaluation, and arbitrary JSX are **not supported**, so there is no path from a
document to `eval`.

---

## `commands`

Declaring a command makes it **discoverable** and gives it a **narrower** policy
evaluation. It never grants permission to run it: policy adjudicates every
command at runtime, declared or not
([ADR-0015](./adr/0015-policy-adjudicates-every-command.md)).

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, unique in the experience. |
| `executable` | yes | `^[A-Za-z0-9._/-]+$`. The program to run. |
| `args` | no | ≤128 default arguments, each a plain string ≤4096 chars. |
| `summary` | yes | ≤200 chars. The one line shown on hover. |
| `description` | no | ≤4000 chars, plain text. |
| `documentId` | no | Must resolve to a document in this experience. |
| `expectsOutput` | no | Documentation quality only, **never** for policy. |

**There is no shell.** A command is a program plus an argument list, never a
command line. `executable` cannot contain shell metacharacters, so there is
nothing to inject into
([ADR-0013](./adr/0013-discrete-executions-no-pty.md)).

---

## `tasks`

Multi-step exercises. Steps are **command ids**, not raw command text, so the
environment and the documentation stay the single source of truth.

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Same id pattern. |
| `title` | yes | |
| `summary` | no | |
| `steps` | yes | 1–50 command ids, each resolving to a command in this experience. |
| `documentId` | no | |

A task never executes anything by itself. Selecting a task prepares commands; it
does not run them.

---

## `secrets`

An experience **names** a secret; it never carries one. Values are supplied out
of band by an operator, encrypted at rest, redacted in every log and error, and
never returned by any API.

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Logical name, unique in the experience. |
| `envVar` | yes | The variable the value is exposed as inside the session. |
| `required` | no | Default `true`: fail session start when the value is absent. |

A `value` field is not expressible. `environment.env` cannot hold one either.

---

## `policies`

**Tightening only.** A policy entry can narrow what an experience may do. It can
never widen it, and it cannot grant a capability policy would otherwise deny
([ADR-0015](./adr/0015-policy-adjudicates-every-command.md)).

| Field | Required | Notes |
|---|---|---|
| `id` | yes | |
| `effect` | yes | `const: "deny"`. There is no `allow`, and adding one is not additive. |
| `reason` | no | Shown to the reader when this entry causes a denial. |
| `match.kind` | yes | `executable`, `networkDestination`, or `filesystemPath`. |
| `match.value` | no | The literal. A leading `*` matches a prefix. |

`match` is a discriminated union on `kind` rather than a set of optional flags,
so a reader is never unsure which shape applies.

---

## What the schema cannot express

These are not disabled by default. They are **not expressible**, so no request
can ask for them. Adding one is an architectural change and needs an ADR.

| Not expressible | Why |
|---|---|
| `privileged` / privileged mode | Rootless by construction. |
| `hostMounts`, `hostPath` | The host filesystem is never visible. |
| `hostNetworking`, `hostNetwork` | Sessions share the platform's network policy, not the host's. |
| `dockerSocket` | No container escapes its own boundary. |
| `capabilities`, `addedCapabilities` | Dropped, and no schema field can add one back. |
| `hostNamespaces`, `hostPid`, `hostIpc` | No host namespaces. |
| `ports`, `publishedPorts` | A session has no ingress route, so publishing a port is meaningless. |
| `allowedCommands` | Commands are free-form. An allow-list would be a security decision made by a manifest, which is exactly what policy forbids. |

Hiding a command in the UI is a **discovery** decision, not a security one. If
it must not run, `policies` says so and `PolicyEvaluator` enforces it.

---

## Versioning

- **Additive** changes (new optional fields) are minor.
- **Removals, renames, and type changes** are breaking: they need a new
  `apiVersion` **and** a migration path for existing experiences.
- A schema change ships in the same change as its regenerated TypeScript, C#, and
  Go types, and its update to this document. `contract-drift` CI fails otherwise.

---

## Related

- [`docs/contracts-reference.md`](./contracts-reference.md) — interaction and session
- [`docs/threat-model.md`](./threat-model.md) — T1–T15
- [`docs/adr/0016-three-versioned-schemas.md`](./adr/0016-three-versioned-schemas.md)
- [`AGENTS.md`](../AGENTS.md) §4.6 — the contract is the contract