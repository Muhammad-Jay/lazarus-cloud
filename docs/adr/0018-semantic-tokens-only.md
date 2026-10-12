# 0018 — Semantic tokens are the only public visual surface

**Status:** Accepted
**Date:** 2026-10-04

## Context

Lazarus's frontend is three clients' worth of surface eventually — web, desktop,
and anything built later — plus a design that has to be legible for reading
documentation and dense enough for a transcript. Consistency across that surface
is a maintainability problem, and the usual failure mode is visible in most
codebases: the same blue appears as four hex values, spacing is whatever the
component author felt like that day, and the only way to change a colour is to
find all the places it was spelled.

Tailwind makes this worse in a specific way. Its utilities are extremely good,
and `bg-red-500` is one keystroke away in every file. A codebase can adopt a
design system and still end up with 200 literal colours, because the fast path
and the correct path are both available at all times and nothing enforces a
choice. Dark mode multiplies it: each component either uses semantic tokens and
gets both themes free, or hardcodes values and grows a `dark:` variant.

The reference implementation this repository was rebuilt from had exactly this
problem — raw values, duplicate scales, inline styles, and a component library
whose visual decisions were invisible in review because each one was a single
local choice that looked reasonable.

## Decision

**Every colour, spacing, radius, shadow, and motion value is defined once in
`packages/tokens` and referenced by semantic name everywhere else. Raw visual
values outside that package are build failures.**

- `packages/tokens` is the **single source** and imports **nothing at all**. It is
  the one leaf with no dependencies.
- Tokens are generated into CSS custom properties and a TS module from one source
  of truth, so the CSS and TS surfaces cannot drift.
- Outside `packages/tokens`, these are **build failures**, caught by lint:
  raw Tailwind colour utilities (`bg-red-500`, `text-slate-700`), arbitrary values
  (`bg-[#0f172a]`), colour functions (`rgb()`, `hsl()`, `oklch()`), and inline
  `style={{}}` carrying a visual property.
- **Dark mode swaps semantic tokens.** It does not add `dark:` variants to
  components. A component that must differ between themes defines a *semantic*
  token, not a theme branch.
- Semantic tokens are the only public surface. The raw palette may be referenced
  inside `packages/tokens` and must not be referenced outside it.
- `packages/ui` holds design-system primitives and holds **no** raw colour values.

## Consequences

### Positive

- A theme change is one edit plus a regeneration. No find-and-replace.
- Dark mode is correct by construction rather than per-component effort.
- The design is reviewable as a system: tokens are a small, readable file, and a
  component diff shows semantics rather than values.
- CI enforces it, so it cannot rot back into four shades of blue.

### Negative

- Every new component needs a token decision first, which is slower than typing a
  colour. This friction is the feature.
- The lint rule is aggressive and will produce false positives on legitimate
  cases (a one-off illustration colour, a third-party component override). Each
  needs either a semantic token or a documented, narrow exemption in the token
  package. We accept the noise rather than weaken the rule.
- Semantic naming requires discipline. A token called `--surface-3` invites
  component-level branching and is the same problem under a nicer name; tokens
  are named for **role** (`--surface-raised`), not for order.

### Neutral

- Tailwind is still used for layout, spacing, and typography mechanics. The ban is
  specifically on raw *visual* values.
- Generated token output is committed so a consumer needs no build step to read
  them.

## Alternatives considered

**Rely on review to keep colours consistent.** Rejected: review does not scale,
and the failure is invisible — every individual value looks fine.

**Allow raw values with a lint warning.** Rejected: a warning that everyone
accepts is the same as no rule, and the count only grows.

**Ban Tailwind's colour palette by config, keep arbitrary values.** Rejected:
arbitrary values are the escape hatch; they must be banned explicitly.

**Keep a small `@theme`-level palette and let components use semantic aliases
without a lint gate.** Rejected: without enforcement, aliases get bypassed the
first time something is urgent.

**Use CSS modules with per-component values.** Rejected: it relocates the same
inconsistency rather than resolving it, and it defeats theme switching.

## References

- [`../../AGENTS.md`](../../AGENTS.md) §3 — the frontend package graph
- [`../../AGENTS.md`](../../AGENTS.md) §4.7 — boundaries are enforced
- [`../../AGENTS.md`](../../AGENTS.md) §5 — visual values live in
  `packages/tokens`
- [`0014-framework-free-interaction-core.md`](./0014-framework-free-interaction-core.md)
