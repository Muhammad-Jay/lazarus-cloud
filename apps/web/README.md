# apps/web

The Lazarus interactive documentation workspace. Next.js 15 (App Router), React 19, TypeScript
strict.

## What belongs here

- App Router routes, layouts, and route groups
- Page and feature composition
- Provider wiring (session, realtime, theme)
- Server Components that fetch and pass down
- Thin UI composition that binds `@lazarus/interaction` to React

## What does not belong here

Anything that is not composition. No business logic, no data access, no state machines, no
validation rules, no hand-written API clients. All of that lives in `packages/` (`AGENTS.md` §3).

If you find yourself writing a `useEffect` that fetches, transforms, and decides — that is a feature
slice, and it goes in `packages/feature-*`.

## Status

Minimal workspace scaffold exists. Consumes `@lazarus/tokens`, `@lazarus/contracts`, and
`@lazarus/interaction`. Real product UI and feature packages are tracked in `TODO.md` (Phases 3–5
focus on UI foundations and the interactive documentation prototype).

## Routes

Planned/initial:

| Route | Purpose                             | Notes                                                                                                                    |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/`   | Interactive documentation workspace | Reads experiences/docs, composes real commands, executes via runtime (or mock in prototype), shows structured transcript |

The workspace is the core surface: hover documentation, contextual suggestions, free-form command
entry, structured transcript rendering. No dashboard, pipelines, endpoints UI, or terminal emulator
— those are not part of the product shape.

## Non-negotiables

- `strict: true`. No `ignoreBuildErrors`. No `ignoreDuringBuilds`.
- No `any`, no `@ts-ignore`, no `eslint-disable` (`AGENTS.md` §5, banned list).
- No `console.*` outside `next.config.ts` — use the package logger wrapper.
- Generated code in `packages/contracts` is never hand-edited.
- Visual values must come from semantic tokens in `@lazarus/tokens` (`AGENTS.md` §4.7). No raw
  Tailwind colors, arbitrary color values, or inline styles carrying visual properties.
- The interaction model lives in `@lazarus/interaction`; it is never reimplemented here.
