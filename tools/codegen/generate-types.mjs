#!/usr/bin/env node
/**
 * Generate TypeScript types from the JSON Schemas.
 *
 * The schemas are the only source of truth (ADR-0016). Nothing under
 * `src/generated/` is hand-edited; an edit is lost on the next run, and
 * `contract-drift` CI fails on the resulting diff.
 *
 * Deterministic by construction: fixed banner, no timestamp, declarations
 * emitted in sorted order, duplicates removed by name. The same schema in
 * produces byte-identical output out, which is what makes a diff in a
 * generated file meaningful rather than noise.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import compileModule from 'json-schema-to-typescript';

// `json-schema-to-typescript` is CommonJS, so interop resolves the import to
// the module object rather than to the function. This is the one place in the
// repository that knows it, rather than a detail at every call site.
const { compile } = compileModule;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @type {readonly {schema: string, output: string}[]} */
const TARGETS = [
  {
    schema: 'packages/spec/lazarus.schema.json',
    output: 'packages/spec/src/generated/experience.ts',
  },
  {
    schema: 'packages/contracts/src/schema/interaction.schema.json',
    output: 'packages/contracts/src/generated/interaction.ts',
  },
  {
    schema: 'packages/contracts/src/schema/session.schema.json',
    output: 'packages/contracts/src/generated/session.ts',
  },
];

const COMPILE_OPTIONS = {
  bannerComment: '',
  additionalProperties: false,
  format: false,
  unknownAny: false,
};

/**
 * Split generated output into exactly one top-level declaration per chunk,
 * each keeping the doc comment that precedes it.
 *
 * Line-based rather than regex-per-block, because the compiler emits consecutive
 * declarations with no blank line between them, so a naive split silently
 * swallows every declaration but the first in a run.
 *
 * @param {string} source generated TypeScript
 * @returns {Map<string, string>} declaration name to its comment plus body
 */
function declarationsByName(source) {
  /** @type {Map<string, string>} */
  const found = new Map();

  const isDeclarationStart = (line) =>
    /^export (?:declare )?(?:type|interface|const|enum) \w+/.test(line);

  /** @type {string[]} */
  let pending = [];
  /** @type {string[]} */
  let current = [];

  const commit = () => {
    if (current.length === 0) {
      pending = [];
      return;
    }
    const named = /^export (?:declare )?(?:type|interface|const|enum) (\w+)/.exec(
      current[0],
    );
    if (named !== null && !found.has(named[1])) {
      found.set(named[1], [...pending, ...current].join('\n').trim());
    }
    pending = [];
    current = [];
  };

  for (const line of source.replace(/^\/\* eslint-disable \*\/\n/, '').split('\n')) {
    if (isDeclarationStart(line)) {
      commit();
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    } else if (line.trim().length > 0) {
      pending.push(line);
    }
  }
  commit();

  return found;
}

/**
 * @param {string} schemaPath repository-relative path to the schema
 * @returns {Promise<string>} the emitted TypeScript for that schema
 */
async function generateFrom(schemaPath) {
  const schema = JSON.parse(readFileSync(join(repoRoot, schemaPath), 'utf8'));
  const defs = schema.$defs ?? {};

  /** @type {Map<string, string>} */
  const declarations = new Map();

  // Every `$defs` entry is compiled as a top-level type. Unreferenced ones —
  // `executionEvent` and `executionRequest` are referenced by the transport
  // rather than by the root document — are otherwise silently dropped, which
  // would leave the contract missing its most important shape.
  //
  // `$id` must be carried onto the synthetic root: without it, `$ref`
  // resolution has no base URI and the compiler throws.
  if (Object.keys(defs).length > 0) {
    const synthetic = {
      $schema: schema.$schema,
      $id: schema.$id,
      title: `${schema.title} definitions`,
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.keys(defs).sort().map((key) => [key, { $ref: `#/$defs/${key}` }]),
      ),
      $defs: defs,
    };

for (const [name, chunk] of declarationsByName(
    await compile(synthetic, COMPILE_OPTIONS),
  )) {
    // The synthetic root exists only to force every `$defs` entry to be emitted.
    // Its own type is a wrapper carrying no meaning, so it is not part of the
    // contract's surface.
    if (name.endsWith('Definitions')) {
      continue;
    }
    declarations.set(name, chunk);
  }
  }

  // The root document itself, named after the schema's `$id`.
  for (const [name, chunk] of declarationsByName(
    await compile(schema, COMPILE_OPTIONS),
  )) {
    if (!declarations.has(name)) {
      declarations.set(name, chunk);
    }
  }

  const body = [...declarations.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, chunk]) => chunk)
    .join('\n\n');

  return [
    '// ---------------------------------------------------------------------------',
    '// GENERATED. DO NOT EDIT.',
    '//',
    `// Source of truth: ${schemaPath}`,
    '// Regenerate with `just codegen`. Fix the schema, not this file.',
    '// ---------------------------------------------------------------------------',
    '',
    body,
    '',
  ].join('\n');
}

for (const target of TARGETS) {
  const output = await generateFrom(target.schema);
  const outPath = join(repoRoot, target.output);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  process.stdout.write(`generated ${target.output}\n`);
}
