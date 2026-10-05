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
 * Strip comments and whitespace so two declarations can be compared structurally.
 *
 * The declaration's own name is replaced with a placeholder: the three copies of
 * `documentationRef` differ in nothing but the name the compiler gave them, and
 * comparing the name would make them look like distinct shapes.
 *
 * @param {string} chunk a single declaration
 * @returns {string} a normalised form used only for equality
 */
function declarationBody(chunk) {
  return chunk
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(export (?:declare )?interface )\w+/, '$1<T>');
}

/**
 * Locate the declaration line inside a chunk, which begins with its doc comment.
 *
 * @param {string} chunk a single declaration, comment included
 * @returns {number} index of the `export` line, or -1 when there is none
 */
function declarationStartLine(chunk) {
  return chunk.split('\n').findIndex((line) => /^export /.test(line));
}

/**
 * Collapse structurally identical interfaces into aliases of one canonical type.
 *
 * `json-schema-to-typescript` emits a fresh interface per reference site rather
 * than hoisting the referenced `$def`. A `$def` referenced from three parents
 * therefore arrived as `DocumentationRef`, `DocumentationRef1` and
 * `DocumentationRef2` — three names for one shape.
 *
 * That is not cosmetic. The duplicates are separate nominal types, so a
 * `DocumentationRef2` is not assignable to a field declared as
 * `DocumentationRef1`, and a consumer has no way to know that. Emitting aliases
 * instead makes the names resolve to one type, so the hazard cannot recur.
 *
 * Aliases rather than a rename because a rename means rewriting every reference
 * in the output — far more surgery on generated text than the problem warrants.
 * The canonical name is the shortest, so the `$def`'s own name wins over the
 * compiler's numeric suffixes, and the choice is deterministic.
 *
 * @param {Map<string, string>} declarations name to declaration
 * @returns {Map<string, string>} declarations with duplicates collapsed
 */
function collapseIdenticalInterfaces(declarations) {
  /** @type {Map<string, string[]>} */
  const byBody = new Map();

  for (const [name, chunk] of declarations) {
    const start = declarationStartLine(chunk);
    if (start === -1 || !/^export (?:declare )?interface \w+/.test(chunk.split('\n')[start])) {
      continue;
    }
    const body = declarationBody(chunk);
    const existing = byBody.get(body);
    if (existing === undefined) {
      byBody.set(body, [name]);
    } else {
      existing.push(name);
    }
  }

  /** @type {Map<string, string>} */
  const collapsed = new Map(declarations);

  for (const names of byBody.values()) {
    if (names.length < 2) {
      continue;
    }
    const [canonical] = [...names].sort(
      (left, right) =>
        left.length - right.length || (left < right ? -1 : left > right ? 1 : 0),
    );
    for (const name of names) {
      if (name === canonical) {
        continue;
      }
      const chunk = collapsed.get(name);
      const start = declarationStartLine(chunk);
      const comment = chunk.split('\n').slice(0, start).join('\n').trim();
      const alias = `export type ${name} = ${canonical};`;
      collapsed.set(name, comment.length > 0 ? `${comment}\n${alias}` : alias);
    }
  }

  return collapsed;
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

  const body = [...collapseIdenticalInterfaces(declarations).entries()]
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
