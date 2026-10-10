import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { registerDefSuite, registerSchemaSuite } from './schema-fixtures.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const interactionSchema: unknown = JSON.parse(
  readFileSync(join(packageRoot, 'src/schema/interaction.schema.json'), 'utf8'),
);

registerSchemaSuite({
  name: 'interaction',
  schemaFile: 'src/schema/interaction.schema.json',
  fixtureDir: 'interaction',
});

/**
 * These two definitions are deliberately unreachable from the schema root: each is a
 * standalone document rather than a field of interaction state. Without their own
 * suite every field in them would be unvalidated, so they are compiled and exercised
 * directly.
 *
 * `localSession` is the browser-side record from LAZARUS_MODEL.md §8. Its invalid
 * fixtures are the interesting ones — no tenancy, no secrets, a required migration
 * version, and only runtime states the server would recognise.
 */
registerDefSuite({
  name: 'interaction',
  schemaFile: 'src/schema/interaction.schema.json',
  fixtureDir: 'interaction',
  defName: 'localSession',
});

registerDefSuite({
  name: 'interaction',
  schemaFile: 'src/schema/interaction.schema.json',
  fixtureDir: 'interaction',
  defName: 'executionRequest',
});

/**
 * The interaction contract is the single definition of the interaction model, so
 * these assertions are about the model holding its shape — not about a schema
 * merely parsing. Each term below is banned for a stated reason; adding one is an
 * architectural change, which is why each case is named.
 */
describe('the interaction contract cannot express a terminal emulator', () => {
  const forbidden = [
    'pty',
    'Pty',
    'terminalFrame',
    'cursorPosition',
    'screen',
    'scrollback',
    'rows',
    'cols',
    'shell',
  ];

  it.each(forbidden)('has no `%s` concept anywhere in the schema', (term: string) => {
    expect(JSON.stringify(interactionSchema)).not.toContain(`"${term}"`);
  });
});

describe('the interaction contract cannot express a literal visual value', () => {
  it('offers only semantic colour roles', () => {
    const serialised = JSON.stringify(interactionSchema);

    expect(serialised).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(serialised).not.toContain('rgb(');
    expect(serialised).not.toContain('hsl(');
  });
});
