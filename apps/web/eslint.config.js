import base from '@lazarus/config/eslint';
import next from '@lazarus/config/eslint/next';

export default [
  ...base,
  ...next,
  {
    ignores: ['next-env.d.ts', '.next/'],
  },
];
