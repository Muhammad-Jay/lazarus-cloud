import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { describe, expect, it } from 'vitest';

/**
 * Golden-fixture harness for this package's schemas.
 *
 * This mirrors the harness in `@lazarus/spec` rather than importing it, because
 * `packages/contracts` is a leaf: it imports nothing at all (`AGENTS.md` §4.7).
 * That rule is why the duplication is correct here. If the leaf rule is ever
 * lifted, this file is deleted in the same change that introduces a shared one.
 */

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The single justified interop boundary in this package: `ajv-formats` is a
 * CommonJS module whose callable plugin is reachable as `.default`. This casts a
 * type rather than widening to `any`, so the plugin stays typed.
 */
const addFormats = formatsModule.default as FormatsPlugin;

export interface SchemaShape {
  readonly $schema?: string;
  readonly $id?: string;
  readonly $defs?: Readonly<Record<string, unknown>>;
}

export interface SchemaSuiteOptions {
  /** Human-readable contract name, used in the describe blocks. */
  readonly name: string;
  /** Path to the schema, relative to the package root. */
  readonly schemaFile: string;
  /** Fixture directory name under `test/fixtures`. */
  readonly fixtureDir: string;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const fixturesIn = (directory: string): readonly string[] =>
  readdirSync(join(packageRoot, 'test', 'fixtures', directory))
    .filter((file: string) => file.endsWith('.json'))
    .sort()
    .map((file: string) => join(packageRoot, 'test', 'fixtures', directory, file));

const fixtureName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/**
 * Ajv reports `required` against the parent object, so the absent property only
 * appears in the error's `params`. Asserting it means a fixture called
 * `missing-tenant.json` cannot pass because some *other* required field is absent.
 */
const matchesMissingProperty = (error: ErrorObject, expected: string): boolean => {
  if (expected === '-') {
    return true;
  }

  const params = error.params as { readonly missingProperty?: string };

  return params.missingProperty === expected;
};

/** Ajv reports the document root as an empty path; the reason table uses `/`. */
const normalisePath = (instancePath: string): string =>
  instancePath.length === 0 ? '/' : instancePath;

interface InvalidReason {
  readonly keyword: string;
  readonly instancePath: string;
  /** For `required`, the exact property that must be absent. `-` otherwise. */
  readonly missingProperty: string;
  readonly reason: string;
}

/**
 * One `filename|keyword|instancePath|missingProperty|reason` per line, with `-`
 * for `missingProperty` when the keyword is not `required`. Asserting the keyword,
 * the path, and the absent property — not merely that validation failed — is what
 * stops a fixture from passing for an unrelated reason, and stops a schema change
 * from quietly making a boundary unexpressible.
 */
const readInvalidReasons = (
  fixtureDir: string,
  reasonsFile: string,
): ReadonlyMap<string, InvalidReason> => {
  const raw = readFileSync(join(packageRoot, 'test', 'fixtures', reasonsFile), 'utf8');

  const entries = raw
    .split('\n')
    .filter((line: string) => line.trim().length > 0 && !line.startsWith('#'))
    .map((line: string) => {
      const [filename, keyword, instancePath, missingProperty, reason, ...rest] = line.split('|');

      if (
        filename === undefined ||
        keyword === undefined ||
        instancePath === undefined ||
        missingProperty === undefined ||
        reason === undefined ||
        rest.length > 0
      ) {
        throw new Error(
          `${reasonsFile} line is not filename|keyword|instancePath|missingProperty|reason: ${line}`,
        );
      }

      void fixtureDir;

      return [filename, { keyword, instancePath, missingProperty, reason }] as const;
    });

  return new Map(entries);
};

export interface DefSuiteOptions extends SchemaSuiteOptions {
  /**
   * A `$def` name. Some definitions are deliberately unreachable from the schema
   * root — `localSession` and `executionRequest` are standalone documents rather
   * than state fields — so nothing would ever validate them. This suite compiles a
   * wrapper that references the definition directly.
   */
  readonly defName: string;
}

/**
 * Validates fixtures against one `$def` instead of the schema root.
 *
 * This exists so a definition cannot be added, broken, and left untested merely
 * because nothing at the root references it. `localSession` is the case that
 * matters: it is the browser-side record, it is not part of interaction state, and
 * without this suite every field in it would be unchecked.
 */
export const registerDefSuite = ({
  name,
  schemaFile,
  fixtureDir,
  defName,
}: DefSuiteOptions): void => {
  const schema = readJson(join(packageRoot, schemaFile)) as SchemaShape;
  const defs = schema.$defs;

  if (defs === undefined || !(defName in defs)) {
    throw new Error(`${schemaFile} has no $defs.${defName}`);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const validate = ajv.compile({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `lazarus-def-${defName}-fixture`,
    $ref: `#/$defs/${defName}`,
    $defs: defs,
  });

  const base = `${fixtureDir}/def-${defName}`;
  const validFixtures = fixturesIn(`${base}/valid`);
  const invalidFixtures = fixturesIn(`${base}/invalid`);
  const reasons = readInvalidReasons(fixtureDir, `${base}/invalid-reasons.txt`);

  const errorsFor = (path: string): readonly ErrorObject[] => {
    validate(readJson(path));

    return validate.errors ?? [];
  };

  describe(`${name} $def ${defName}`, () => {
    it('has at least one valid fixture', () => {
      expect(validFixtures.length).toBeGreaterThan(0);
    });

    it('has at least one invalid fixture', () => {
      expect(invalidFixtures.length).toBeGreaterThan(0);
    });
  });

  describe(`${name} $def ${defName} accepted fixtures`, () => {
    it.each(validFixtures)('accepts %s', (path: string) => {
      validate(readJson(path));

      expect(validate.errors ?? []).toEqual([]);
    });
  });

  describe(`${name} $def ${defName} rejected fixtures`, () => {
    it('has a named reason for every invalid fixture', () => {
      expect(invalidFixtures.map(fixtureName).sort()).toEqual([...reasons.keys()].sort());
    });

    it.each(invalidFixtures)('rejects %s for its named keyword and path', (path: string) => {
      const fixture = fixtureName(path);
      const expected = reasons.get(fixture);

      if (expected === undefined) {
        throw new Error(`${fixture} has no named reason in ${base}/invalid-reasons.txt`);
      }

      const errors = errorsFor(path);

      expect(
        errors.some(
          (error: ErrorObject) =>
            error.keyword === expected.keyword &&
            normalisePath(error.instancePath) === normalisePath(expected.instancePath) &&
            matchesMissingProperty(error, expected.missingProperty),
        ),
        `expected ${fixture} to fail with ${expected.keyword} at ${expected.instancePath} (${expected.reason}), got ${errors
          .map((error: ErrorObject) => `${error.keyword} at ${normalisePath(error.instancePath)}`)
          .join(', ')}`,
      ).toBe(true);
    });
  });
};

export const registerSchemaSuite = ({
  name,
  schemaFile,
  fixtureDir,
}: SchemaSuiteOptions): void => {
  const schema = readJson(join(packageRoot, schemaFile)) as SchemaShape;

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);

  const validate = ajv.compile(readJson(join(packageRoot, schemaFile)) as object);

  const validFixtures = fixturesIn(`${fixtureDir}/valid`);
  const invalidFixtures = fixturesIn(`${fixtureDir}/invalid`);
  const reasons = readInvalidReasons(fixtureDir, `${fixtureDir}/invalid-reasons.txt`);

  /** `validate.errors` is only populated by the most recent call, so read it now. */
  const errorsFor = (path: string): readonly ErrorObject[] => {
    validate(readJson(path));

    return validate.errors ?? [];
  };

  describe(`${name} schema`, () => {
    it('is a draft 2020-12 schema with an $id so $ref resolution has a base', () => {
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema.$id).toMatch(/^https:\/\/lazarus\.dev\/schemas\//);
      expect(ajv.errors).toBeNull();
    });

    it('has at least one valid fixture', () => {
      expect(validFixtures.length).toBeGreaterThan(0);
    });

    it('has at least one invalid fixture', () => {
      expect(invalidFixtures.length).toBeGreaterThan(0);
    });
  });

  describe(`${name} accepted fixtures`, () => {
    it.each(validFixtures)('accepts %s', (path: string) => {
      validate(readJson(path));

      expect(validate.errors ?? []).toEqual([]);
    });
  });

  describe(`${name} rejected fixtures`, () => {
    it('has a named reason for every invalid fixture', () => {
      expect(invalidFixtures.map(fixtureName).sort()).toEqual([...reasons.keys()].sort());
    });

    it.each(invalidFixtures)(
      'rejects %s for its named keyword and path',
      (path: string) => {
        const fixture = fixtureName(path);
        const expected = reasons.get(fixture);

        if (expected === undefined) {
          throw new Error(`${fixture} has no named reason in ${fixtureDir}/invalid-reasons.txt`);
        }

        const errors = errorsFor(path);

        expect(
          errors.some(
            (error: ErrorObject) =>
              error.keyword === expected.keyword &&
              normalisePath(error.instancePath) === normalisePath(expected.instancePath) &&
              matchesMissingProperty(error, expected.missingProperty),
          ),
          `expected ${fixture} to fail with ${expected.keyword} at ${expected.instancePath} (${expected.reason}), got ${errors
            .map(
              (error: ErrorObject) =>
                `${error.keyword} at ${normalisePath(error.instancePath)}`,
            )
            .join(', ')}`,
        ).toBe(true);
      },
    );
  });
};