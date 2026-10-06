import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..', '..', '..');
const schemaPath = resolve(root, 'packages', 'contracts', 'src', 'schema', 'interaction.schema.json');
const tokensJsonPath = resolve(root, 'packages', 'tokens', 'src', 'tokens.json');
const tsPath = resolve(root, 'packages', 'tokens', 'src', 'generated', 'tokens.ts');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('color roles match schema', () => {
  it('ColorRole enum matches colorRoles in tokens.json and generated TS', () => {
    const schema = JSON.parse(read(schemaPath));
    const enumRoles = schema.$defs.colorRole.enum.sort();
    const tokens = JSON.parse(read(tokensJsonPath));
    const tokenRoles = Object.keys(tokens.colorRoles).sort();
    expect(tokenRoles).toEqual(enumRoles);
    const ts = read(tsPath);
    const tsRoles = [];
    for (const m of ts.matchAll(/\|\s*'([^']+)'/g)) {
      tsRoles.push(m[1]);
    }
    tsRoles.sort();
    expect(tsRoles).toEqual(enumRoles);
  });
});
