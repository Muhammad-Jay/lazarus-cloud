/**
 * `@lazarus/contracts` — the generated interaction and session contract.
 *
 * Every type here is generated from `src/schema/*.json`. The package imports
 * nothing (`AGENTS.md` §4.7), and consumers import from the package, never from
 * another package's `src/`.
 *
 * The exports are a wildcard on purpose. An explicit re-export list is a
 * hand-maintained mirror of the schema's type names, so it silently goes stale the
 * moment a schema gains a definition — which is exactly what happened when
 * `localSession` and `structuredOutput` were added. One list, two places to
 * forget. A wildcard has no list to forget.
 *
 * `export type *` rather than `export *` because everything in these modules is a
 * type; a value export here would mean the generator had started emitting runtime
 * code, which is a change worth failing on.
 */

export type * from './generated/interaction.js';
export type * from './generated/session.js';

/**
 * Both schemas are independently versioned documents (ADR-0016), so each declares
 * its own `Uuid` and `IsoTimestamp`. Those are the same concept, which is why they
 * collide here, and they are structurally identical, so re-exporting one definition
 * loses nothing.
 *
 * This is the only hand-maintained entry in the package, and it exists to
 * disambiguate rather than to mirror. It cannot silently go stale: if a future
 * schema introduces a third colliding name, TypeScript fails the build with
 * TS2308 rather than exporting the wrong one.
 */
export type { IsoTimestamp, Uuid } from './generated/interaction.js';
