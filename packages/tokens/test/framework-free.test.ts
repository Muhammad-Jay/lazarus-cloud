import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = resolve(__dirname, '..');
const srcRoot = resolve(pkgRoot, 'src');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

describe('@lazarus/tokens framework-free boundary', () => {
  it('does not import outside its own src (leaf package)', () => {
    const files: string[] = [];
    function walk(dir: string): void {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (
          p.endsWith('.ts') ||
          p.endsWith('.js') ||
          p.endsWith('.mjs') ||
          p.endsWith('.cts') ||
          p.endsWith('.mts')
        ) {
          files.push(p);
        }
      }
    }
    walk(srcRoot);
    for (const f of files) {
      const txt = readFileSync(f, 'utf8');
      for (const m of txt.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        if (
          spec.startsWith('node:') ||
          spec.startsWith('./') ||
          spec.startsWith('../') ||
          spec === '.'
        )
          continue;
        if (spec.startsWith('@lazarus/tokens')) continue;
        throw new Error(`external import in ${f}: ${spec}`);
      }
    }
  });

  it('has no dependencies field in package.json', () => {
    const pkg = JSON.parse(read(`${pkgRoot}/package.json`));
    expect(pkg.dependencies).toBeUndefined();
  });
});
