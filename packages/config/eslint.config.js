import base from './eslint/base.js';

export default [
  ...base,
  {
    rules: {
      'import/no-unresolved': 'off',
    },
  },
];
