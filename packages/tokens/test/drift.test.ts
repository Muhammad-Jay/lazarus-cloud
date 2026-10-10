import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..', '..', '..');
const tsPath = resolve(root, 'packages', 'tokens', 'src', 'generated', 'tokens.ts');
const cssPath = resolve(root, 'packages', 'tokens', 'src', 'generated', 'tokens.css');

function read(p: string): string {
  return readFileSync(p, 'utf8');
}

function generateTokens(): void {
  execFileSync(process.execPath, ['tools/codegen/generate-tokens.mjs'], { cwd: root });
}

describe('token generation drift', () => {
  it('regeneration produces identical committed files', () => {
    const beforeTs = read(tsPath);
    const beforeCss = read(cssPath);
    generateTokens();
    const afterTs = read(tsPath);
    const afterCss = read(cssPath);
    expect(afterTs).toBe(beforeTs);
    expect(afterCss).toBe(beforeCss);
  });

  it('is idempotent (twice produces same output)', () => {
    generateTokens();
    const t1 = read(tsPath);
    const c1 = read(cssPath);
    generateTokens();
    const t2 = read(tsPath);
    const c2 = read(cssPath);
    expect(t2).toBe(t1);
    expect(c2).toBe(c1);
  });
});
