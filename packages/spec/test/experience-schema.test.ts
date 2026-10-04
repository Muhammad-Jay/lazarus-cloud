import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { describe, expect, it } from 'vitest';

/**
 * The single justified interop boundary in this package: `ajv-formats` is a
 * CommonJS module whose callable plugin is reachable as `.default`. This is a
 * cast of a *type*, not a widening to `any`, so the plugin stays typed.
 */
const addFormats = formatsModule.default as FormatsPlugin;

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The schema is read as `unknown` and narrowed once, here, so that every
 * assertion below is checked rather than inherited from `JSON.parse`.
 */
interface SchemaShape {
  readonly $schema?: string;
  readonly $id?: string;
  readonly $defs?: Readonly<Record<string, DefinitionShape | undefined>>;
}

interface DefinitionShape {
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, PropertyShape | undefined>>;
}

interface PropertyShape {
  readonly const?: unknown;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const schema = readJson(join(packageRoot, 'lazarus.schema.json')) as SchemaShape;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const validate = ajv.compile(readJson(join(packageRoot, 'lazarus.schema.json')) as object);

/**
 * Narrow one `$defs` entry, so `noUncheckedIndexedAccess` cannot silently turn
 * a typo in a test into an assertion that silently passes.
 */
const definition = (name: string): DefinitionShape => {
  const found = schema.$defs?.[name];

  if (found === undefined) {
    throw new Error(`lazarus.schema.json has no $defs.${name}`);
  }

  return found;
};

const property = (definitionName: string, propertyName: string): PropertyShape => {
  const found = definition(definitionName).properties?.[propertyName];

  if (found === undefined) {
    throw new Error(`lazarus.schema.json has no $defs.${definitionName}.${propertyName}`);
  }

  return found;
};

const fixturesIn = (directory: string): readonly string[] =>
  readdirSync(join(packageRoot, 'test', 'fixtures', directory))
    .filter((name: string) => name.endsWith('.json'))
    .sort()
    .map((name: string) => join(packageRoot, 'test', 'fixtures', directory, name));

const validFixtures = fixturesIn('valid');
const invalidFixtures = fixturesIn('invalid');

const fixtureName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** Ajv reports the document root as an empty path; the reason table uses `/`. */
const normalisePath = (instancePath: string): string =>
  instancePath.length === 0 ? '/' : instancePath;

interface InvalidReason {
  readonly keyword: string;
  readonly instancePath: string;
  readonly reason: string;
}

/**
 * One `filename|keyword|instancePath|reason` per line. Asserting the keyword and
 * the path — not merely that validation failed — is what stops a fixture from
 * passing for an unrelated reason, and stops a schema change from quietly
 * making a boundary unexpressible.
 */
const readInvalidReasons = (): ReadonlyMap<string, InvalidReason> => {
  const raw = readFileSync(
    join(packageRoot, 'test', 'fixtures', 'invalid-reasons.txt'),
    'utf8',
  );

  const entries = raw
    .split('\n')
    .filter((line: string) => line.trim().length > 0 && !line.startsWith('#'))
    .map((line: string) => {
      const [filename, keyword, instancePath, reason, ...rest] = line.split('|');

      if (
        filename === undefined ||
        keyword === undefined ||
        instancePath === undefined ||
        reason === undefined ||
        rest.length > 0
      ) {
        throw new Error(
          `invalid-reasons.txt line is not filename|keyword|instancePath|reason: ${line}`,
        );
      }

      return [filename, { keyword, instancePath, reason }] as const;
    });

  return new Map(entries);
};

/** `validate.errors` is only populated by the most recent call, so read it now. */
const errorsFor = (path: string): readonly ErrorObject[] => {
  validate(readJson(path));

  return validate.errors ?? [];
};

describe('experience schema', () => {
  it('is a draft 2020-12 schema with an $id so $ref resolution has a base', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toBe('https://lazarus.dev/schemas/experience/v1');
    expect(ajv.errors).toBeNull();
  });

  it('has at least one valid fixture', () => {
    expect(validFixtures.length).toBeGreaterThan(0);
  });
});

describe('accepted fixtures', () => {
  it.each(validFixtures)('accepts %s', (path: string) => {
    validate(readJson(path));

    expect(validate.errors ?? []).toEqual([]);
    expect(validate.errors).toBeNull();
  });
});

describe('rejected fixtures', () => {
  const reasons = readInvalidReasons();

  it('has a named reason for every invalid fixture', () => {
    expect(invalidFixtures.map(fixtureName).sort()).toEqual([...reasons.keys()].sort());
  });

  it.each(invalidFixtures)('rejects %s for its named keyword and path', (path: string) => {
    const name = fixtureName(path);
    const expected = reasons.get(name);

    if (expected === undefined) {
      throw new Error(`${name} has no named reason in invalid-reasons.txt`);
    }

    const errors = errorsFor(path);

    expect(
      errors.some(
        (error: ErrorObject) =>
          error.keyword === expected.keyword &&
          normalisePath(error.instancePath) === normalisePath(expected.instancePath),
      ),
      `expected ${name} to fail with ${expected.keyword} at ${expected.instancePath} (${expected.reason}), got ${errors
        .map((error: ErrorObject) => `${error.keyword} at ${normalisePath(error.instancePath)}`)
        .join(', ')}`,
    ).toBe(true);
  });
});

describe('the schema cannot express a privilege escalation', () => {
  /**
   * The schema is a security boundary, not a validation convenience: these
   * capabilities must be unexpressible, so no request can ask for them
   * (ADR-0015). A new field needs an ADR, which is why each case is named here.
   */
  const forbidden = [
    'privileged',
    'privilegedMode',
    'hostMounts',
    'hostNetworking',
    'hostNetwork',
    'dockerSocket',
    'capabilities',
    'addedCapabilities',
    'hostNamespaces',
    'hostPid',
    'hostIpc',
    'hostPath',
    'ports',
    'publishedPorts',
    'allowedCommands',
  ];

  it.each(forbidden)('has no `%s` field anywhere in the schema', (field: string) => {
    expect(JSON.stringify(schema)).not.toContain(`"${field}"`);
  });

  it('requires every field of a resources object', () => {
    expect(definition('resources').required).toEqual(['memoryMb', 'cpus', 'pids']);
  });

  it('only permits a deny effect on a policy entry', () => {
    expect(property('policyTightening', 'effect').const).toBe('deny');
  });
});
