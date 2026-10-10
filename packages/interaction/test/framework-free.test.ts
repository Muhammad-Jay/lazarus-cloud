import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The framework-free claim, enforced rather than asserted.
 *
 * ADR-0014 and §4.7 make this package a leaf that imports nothing but
 * `@lazarus/contracts`: no React, no DOM, no fetch, no storage, no timers. The
 * `environment: 'node'` vitest setting already means a stray `document` reference
 * fails at runtime, but it would not stop someone adding a *type-only* import of
 * React, a dependency on `setTimeout`, or a second runtime dependency.
 *
 * So this reads the source. A comment mentioning React is fine; an import is not,
 * which is why the check looks at import statements rather than searching for the
 * word.
 */

const SRC = 'src';

/** `@lazarus/contracts` is the only permitted package import. */
const ALLOWED_PACKAGE_SPECIFIERS = new Set(['@lazarus/contracts']);

/**
 * Sibling modules inside this package, by relative specifier.
 *
 * Listed explicitly rather than pattern-matched, so adding a module means adding it
 * here too. That is the point: a new sibling import should be a deliberate line in
 * a test, not something a loose `./` pattern waves through.
 */
const ALLOWED_SIBLINGS = new Set([
  './actions.js',
  './ansi.js',
  './ids.js',
  './ranking.js',
  './reducer.js',
  './transcript.js',
]);

const sourceFiles = (): string[] =>
  readdirSync(SRC)
    .filter((name) => name.endsWith('.ts'))
    .sort();

/**
 * Module specifiers from static `import`/`export` and dynamic `import()` forms.
 *
 * The leading `from` is required so a bare word inside prose or a string in a test
 * fixture cannot be mistaken for an import.
 */
const specifiersIn = (source: string): string[] => {
  const found: string[] = [];
  const patterns = [
    /^\s*import\s+[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm,
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /^\s*export\s+[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) {
        found.push(match[1]);
      }
    }
  }
  return found;
};

/** Strip comments so prose in a doc comment is not read as code. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/**
 * Strip string and template literals.
 *
 * Needed because a bare-word check for `document` would otherwise fire on
 * `document: 0.35` — an object key in the search-kind weights, which has nothing
 * to do with the DOM. The globals this file is checking for are identifiers, and a
 * literal can never be one.
 */
const stripLiterals = (source: string): string =>
  source
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

/**
 * Blank out identifier followed by a colon, i.e. an object key or a type member.
 *
 * The bare-word check for `document` still fires on `document: 0.35`, the
 * search-kind weight, even with literals stripped — because a key is a bare
 * identifier, not a literal. Matching the colon distinguishes a key from a
 * reference, which is the distinction that matters: `document.something` is a
 * global reference, `{ document: x }` is data.
 */
const stripObjectKeys = (source: string): string =>
  source.replace(/(?<=[{,\s])([A-Za-z_$][\w$]*)\s*:/g, "'__key__':");

describe('@lazarus/interaction is framework-free', () => {
  it.each(sourceFiles())('%s imports only @lazarus/contracts or a declared sibling', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    for (const specifier of specifiersIn(stripComments(source))) {
      const permitted =
        ALLOWED_PACKAGE_SPECIFIERS.has(specifier) || ALLOWED_SIBLINGS.has(specifier);
      expect(permitted, `${file} imports ${specifier}`).toBe(true);
    }
  });

  it.each(sourceFiles())('%s does not reach into another package src/', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    for (const specifier of specifiersIn(stripComments(source))) {
      const isSibling = specifier.startsWith('./') || specifier.startsWith('../');
      const isInsideSrc = specifier.startsWith('../src/') || specifier.includes('/src/');
      expect(isSibling && isInsideSrc, `${file} reaches outside the package: ${specifier}`).toBe(false);
    }
  });

  it('has a sibling allow-list matching the files that exist', () => {
    // Keeps the list above honest as modules are added or removed.
    const actual = sourceFiles().map((name) => `./${name.replace(/\.ts$/, '.js')}`);
    expect([...ALLOWED_SIBLINGS].filter((name) => !actual.includes(name))).toEqual([]);
  });

  it.each(sourceFiles())('%s uses no browser global', (file) => {
    const source = stripObjectKeys(
      stripLiterals(stripComments(readFileSync(join(SRC, file), 'utf8'))),
    );
    const forbidden = [
      'document',
      'window',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'navigator',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'setTimeout',
      'setInterval',
      'requestAnimationFrame',
      'queueMicrotask',
      'process',
    ];
    for (const name of forbidden) {
      // Word-boundary match so `processed` does not trip `process`.
      const pattern = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
      expect(pattern.test(source), `${file} references ${name}`).toBe(false);
    }
  });

  it.each(sourceFiles())('%s does not reach for a clock or randomness', (file) => {
    const source = stripLiterals(stripComments(readFileSync(join(SRC, file), 'utf8')));
    // §5's consistency rules: one injected time source, never `Date.now()` in
    // logic. A reducer that read a clock would not be a pure function.
    expect(source, `${file} calls Date.now`).not.toMatch(/Date\.now\s*\(/);
    expect(source, `${file} constructs a Date`).not.toMatch(/new\s+Date\b/);
    expect(source, `${file} calls Math.random`).not.toMatch(/Math\.random\s*\(/);
  });

  it('declares no dependency other than the contracts package', async () => {
    const manifest = JSON.parse(
      readFileSync(join(SRC, '..', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    expect(Object.keys(manifest.dependencies ?? {}), 'runtime dependencies').toEqual([
      '@lazarus/contracts',
    ]);
  });

  it('exports its public surface from the package root only', async () => {
    // Subpath exports would let a consumer reach into `src/` and bypass the
    // boundary; one entry point keeps the surface legible.
    const manifest = JSON.parse(
      readFileSync(join(SRC, '..', 'package.json'), 'utf8'),
    ) as { exports?: Record<string, string> };
    expect(Object.keys(manifest.exports ?? {})).toEqual(['.']);
  });
});
