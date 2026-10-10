import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The generated modules are the contract every client compiles against, so a
 * defect in them is a defect in the product's type surface rather than noise in a
 * build log.
 *
 * The case that motivated this file: `json-schema-to-typescript` emits one
 * interface per `$ref` site instead of hoisting the target, so the single
 * `documentationRef` `$def` reached consumers as `DocumentationRef`,
 * `DocumentationRef1` and `DocumentationRef2`. Structurally identical, nominally
 * distinct — `CommandSuggestion.doc` was not assignable to
 * `InlineDocumentation.doc` despite both being a documentation reference. The
 * generator now collapses those copies into aliases
 * (`tools/codegen/generate-types.mjs`, `collapseIdenticalInterfaces`), and this
 * test is what stops that from quietly coming back.
 */

const GENERATED_DIR = 'src/generated';

const generatedFiles = (): string[] =>
  readdirSync(GENERATED_DIR).filter((name) => name.endsWith('.ts')).sort();

interface Declaration {
  name: string;
  kind: 'interface' | 'type';
  /** Comment-stripped, whitespace-collapsed body, with the name masked out. */
  shape: string;
}


const declarationsOf = (source: string): Declaration[] => {
  const starts = [...source.matchAll(/^export (?:declare )?(interface|type) (\w+)/gm)];
  return starts.map((match, index) => {
    const end = starts[index + 1]?.index ?? source.length;
    const chunk = source.slice(match.index, end);
    return {
      name: match[2] as string,
      kind: match[1] as 'interface' | 'type',
      shape: chunk
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/(export (?:declare )?(?:interface|type) )\w+/, '$1<T>'),
    };
  });
};

describe('generated modules', () => {
  it.each(generatedFiles())('%s declares no two structurally identical interfaces', (file) => {
    const declarations = declarationsOf(
      readFileSync(join(GENERATED_DIR, file), 'utf8'),
    );

    // Only real declarations can be duplicated. A `type X = Y` alias is how the
    // generator represents a deliberate duplicate, and comparing those would flag
    // the fix itself.
    const interfaces = declarations.filter((entry) => entry.kind === 'interface');

    const byShape = new Map<string, string[]>();
    for (const entry of interfaces) {
      const existing = byShape.get(entry.shape);
      if (existing === undefined) {
        byShape.set(entry.shape, [entry.name]);
      } else {
        existing.push(entry.name);
      }
    }

    const duplicates = [...byShape.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([shape, names]) => `${names.join(', ')} — ${shape.slice(0, 120)}`);

    expect(duplicates).toEqual([]);
  });

  it.each(generatedFiles())('%s exports every declared type under a distinct name', (file) => {
    const names = declarationsOf(
      readFileSync(join(GENERATED_DIR, file), 'utf8'),
    ).map((entry) => entry.name);

    expect(new Set(names).size).toBe(names.length);
  });
});
