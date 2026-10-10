import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { registerSchemaSuite } from './schema-fixtures.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const sessionSchema: unknown = JSON.parse(
  readFileSync(join(packageRoot, 'src/schema/session.schema.json'), 'utf8'),
);

registerSchemaSuite({
  name: 'session',
  schemaFile: 'src/schema/session.schema.json',
  fixtureDir: 'session',
});

/**
 * A session is temporary and unpublished. The contract is the boundary that keeps
 * it that way, so the terms that would reintroduce a published session or a
 * server-held transcript are asserted absent rather than left to review.
 */
describe('the session contract holds the session temporary and unpublished', () => {
  const forbidden = [
    'ingress',
    'subdomain',
    'hostname',
    'publicUrl',
    'publishedPort',
    'hostPort',
    'transcript',
    'blocks',
    'commands',
    'commandText',
    'output',
    'stdout',
    'stderr',
    'history',
  ];

  it.each(forbidden)('has no `%s` field anywhere in the schema', (field: string) => {
    expect(JSON.stringify(sessionSchema)).not.toContain(`"${field}"`);
  });
});

describe('the session contract holds no absolute endpoint', () => {
  it('requires hubUrl to be root-relative and not protocol-relative', () => {
    expect(JSON.stringify(sessionSchema)).toContain('^(?!//)/');
  });
});
