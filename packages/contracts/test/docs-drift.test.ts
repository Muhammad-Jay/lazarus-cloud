import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path: string): string => readFileSync(path, 'utf8');

const interactionSchema: { properties?: Record<string, unknown> } = JSON.parse(
  read(join(packageRoot, 'src', 'schema', 'interaction.schema.json')),
);
const sessionSchema: { properties?: Record<string, unknown> } = JSON.parse(
  read(join(packageRoot, 'src', 'schema', 'session.schema.json')),
);

const reference = read(join(packageRoot, '..', '..', 'docs', 'contracts-reference.md'));

/** The markdown body of a `## <title>` section, up to the next `## ` heading. */
function section(markdown: string, title: string): string {
  const marker = `\n## ${title}\n`;
  const start = markdown.indexOf(marker);
  if (start === -1) throw new Error(`section not found: ${title}`);
  const rest = markdown.slice(start + marker.length);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

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

describe('Contracts reference doc matches the schemas', () => {
  it('documents exactly the interaction root fields', () => {
    const documented = new Set(
      fieldsUnderHeading(section(reference, 'Interaction'), /^### Root\s*$/u),
    );
    expect(documented).toEqual(new Set(Object.keys(interactionSchema.properties ?? {})));
  });

  it('documents exactly the session root fields', () => {
    const documented = new Set(fieldsUnderHeading(section(reference, 'Session'), /^### Root\s*$/u));
    expect(documented).toEqual(new Set(Object.keys(sessionSchema.properties ?? {})));
  });
});
