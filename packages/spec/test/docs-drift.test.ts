import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const experienceSchema: { properties?: Record<string, unknown>; required?: string[] } = JSON.parse(
  readFileSync(join(packageRoot, 'lazarus.schema.json'), 'utf8'),
);

const reference = readFileSync(
  join(packageRoot, '..', '..', 'docs', 'experience-reference.md'),
  'utf8',
);

/**
 * Field names from the first column of the markdown table under `heading`.
 * Stops at the next heading or horizontal rule, so a documentation section
 * cannot silently gain or lose a field.
 */
function fieldsUnderHeading(markdown: string, heading: RegExp): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) throw new Error(`heading not found: ${String(heading)}`);

  const fields: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? '').trim();
    if (trimmed.startsWith('#') || trimmed === '---') break;
    if (!trimmed.startsWith('|')) {
      if (fields.length > 0) break;
      continue;
    }
    const first = (trimmed.split('|')[1] ?? '').trim().replace(/^`|`$/gu, '');
    if (first === '' || /^-+$/u.test(first) || first === 'Field') continue;
    fields.push(first);
  }
  return fields;
}

describe('Experience reference doc matches the schema', () => {
  it('documents exactly the schema top-level fields', () => {
    const documented = new Set(fieldsUnderHeading(reference, /^## Top level\s*$/u));
    const schemaFields = new Set(Object.keys(experienceSchema.properties ?? {}));

    expect(documented).toEqual(schemaFields);
  });

  it('marks exactly the schema-required top-level fields as required', () => {
    const requiredRows = reference
      .split('\n')
      .filter((line) => /\|\s*`[^`]+`\s*\|\s*yes\s*\|/u.test(line));
    const documentedRequired = new Set(
      requiredRows
        .map((line) => (line.split('|')[1] ?? '').trim().replace(/^`|`$/gu, ''))
        .filter((name) => (experienceSchema.properties ?? {})[name] !== undefined),
    );

    expect(documentedRequired).toEqual(new Set(experienceSchema.required ?? []));
  });
});
