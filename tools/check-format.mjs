import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TEXT_EXTENSIONS = new Set([
  '.cs',
  '.css',
  '.go',
  '.json',
  '.js',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const TEXT_FILENAMES = new Set([
  '.gitattributes',
  '.gitignore',
  'justfile',
  'pnpm-workspace.yaml',
]);

const write = process.argv.includes('--write');

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

function isTextPath(path) {
  if (TEXT_FILENAMES.has(path)) return true;
  const dot = path.lastIndexOf('.');
  return dot >= 0 && TEXT_EXTENSIONS.has(path.slice(dot));
}

function normalize(source) {
  const withoutTrailingWhitespace = source
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/u, ''))
    .join('\n');

  return withoutTrailingWhitespace.replace(/\n*$/u, '\n');
}

const changed = [];

for (const path of trackedFiles()) {
  if (!isTextPath(path)) continue;

  const before = readFileSync(path, 'utf8');
  const after = normalize(before);
  if (after === before) continue;

  changed.push(path);
  if (write) {
    writeFileSync(path, after);
  }
}

if (changed.length > 0) {
  const verb = write ? 'formatted' : 'need formatting';
  console.error(`format: ${changed.length} file(s) ${verb}:`);
  for (const path of changed) {
    console.error(`  ${path}`);
  }
  process.exit(write ? 0 : 1);
}

console.log('format: ok');
