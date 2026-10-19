import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@next/next/no-img-element': 'error',
      '@next/next/no-html-link-for-pages': 'error',
      '@next/next/no-page-custom-font': 'error',
      '@next/next/no-script-component-in-head': 'error',
      '@next/next/no-sync-scripts': 'error',
      '@next/next/no-before-interactive-script-outside-document': 'error',
      '@next/next/no-document-import-in-page': 'error',
      '@next/next/no-head-element': 'error',
      '@next/next/no-title-in-document-head': 'error',
    },
  },
]);
