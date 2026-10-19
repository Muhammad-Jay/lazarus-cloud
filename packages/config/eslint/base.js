import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const packageBoundaries = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce package boundary rules for Lazarus workspace',
      recommended: 'error',
    },
    schema: [],
    messages: {
      forbiddenImport: '{{message}}',
      srcImport: '{{message}}',
    },
  },
  create(context) {
    const filename = context.filename;
    const getCwd = () => (typeof globalThis !== 'undefined' && globalThis.process?.cwd?.()) || '';
    const WORKSPACE_ROOT = getCwd();

    const PACKAGE_RULES = {
      '@lazarus/tokens': {
        allowedImports: [],
        forbiddenImports: ['@lazarus/'],
        allowExternal: true,
      },
      '@lazarus/contracts': {
        allowedImports: [],
        forbiddenImports: ['@lazarus/'],
        allowExternal: true,
      },
      '@lazarus/interaction': {
        allowedImports: ['@lazarus/contracts'],
        forbiddenImports: ['@lazarus/tokens', '@lazarus/spec', '@lazarus/ui', '@lazarus/feature-'],
        allowExternal: true,
      },
      '@lazarus/spec': {
        allowedImports: [],
        forbiddenImports: ['@lazarus/'],
        allowExternal: true,
      },
      web: {
        allowedImports: [
          '@lazarus/contracts',
          '@lazarus/interaction',
          '@lazarus/tokens',
          '@lazarus/ui',
          '@lazarus/feature-',
          '@lazarus/api-client',
          '@lazarus/realtime',
        ],
        forbiddenImports: [],
        allowExternal: true,
      },
    };

    function getPackageName(filePath) {
      const relPath = filePath.replace(`${WORKSPACE_ROOT}/`, '');
      const parts = relPath.split('/');
      if (parts[0] === 'packages') return parts[1];
      if (parts[0] === 'apps') return parts[1];
      if (parts[0] === 'services') return parts[1];
      return null;
    }

    function getPackageConfig(filePath) {
      const pkgName = getPackageName(filePath);
      if (!pkgName) return null;

      if (pkgName.startsWith('feature-')) {
        return {
          allowedImports: [
            '@lazarus/contracts',
            '@lazarus/interaction',
            '@lazarus/tokens',
            '@lazarus/ui',
            '@lazarus/api-client',
            '@lazarus/realtime',
          ],
          forbiddenImports: ['@lazarus/feature-'],
          allowExternal: true,
        };
      }

      if (pkgName.startsWith('ui')) {
        return {
          allowedImports: ['@lazarus/tokens'],
          forbiddenImports: [
            '@lazarus/contracts',
            '@lazarus/interaction',
            '@lazarus/spec',
            '@lazarus/feature-',
            '@lazarus/api-client',
            '@lazarus/realtime',
          ],
          allowExternal: true,
        };
      }

      return PACKAGE_RULES[pkgName] || null;
    }

    function isExternalImport(source) {
      return !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@lazarus/');
    }

    function isWorkspaceImport(source) {
      return source.startsWith('@lazarus/');
    }

    function checkImport(source, importerPath) {
      const importerConfig = getPackageConfig(importerPath);
      if (!importerConfig) return null;

      if (isExternalImport(source)) {
        return importerConfig.allowExternal
          ? null
          : {
              message: `External imports are not allowed in this package. Import: ${source}`,
            };
      }

      if (!isWorkspaceImport(source)) return null;

      const targetPkg = source.split('/')[1];
      const fullTargetPkg = `@lazarus/${targetPkg}`;

      if (
        importerConfig.forbiddenImports.some((forbidden) => {
          if (forbidden.endsWith('-')) return fullTargetPkg.startsWith(forbidden);
          return fullTargetPkg === forbidden;
        })
      ) {
        return {
          message: `Import "${source}" is forbidden for this package. Check package boundary rules.`,
        };
      }

      if (importerConfig.allowedImports.length > 0) {
        const isAllowed = importerConfig.allowedImports.some((allowed) => {
          if (allowed.endsWith('-')) return fullTargetPkg.startsWith(allowed);
          return fullTargetPkg === allowed;
        });
        if (!isAllowed) {
          return {
            message: `Import "${source}" is not in the allowed imports list for this package. Allowed: ${importerConfig.allowedImports.join(', ')}`,
          };
        }
      }

      return null;
    }

    function checkSrcImport(source) {
      // Only forbid cross-package src imports (e.g., @lazarus/tokens/src/...)
      // Allow relative imports within the same package (e.g., ../src/generated/...)
      if (source.startsWith('@lazarus/') && source.includes('/src/')) {
        return {
          message: `Importing from another package's "src/" directory is forbidden. Use subpath exports instead. Import: ${source}`,
        };
      }
      return null;
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        const srcError = checkSrcImport(source);
        if (srcError) {
          context.report({ node, messageId: 'srcImport', data: { message: srcError.message } });
        }
        const boundaryError = checkImport(source, filename);
        if (boundaryError) {
          context.report({
            node,
            messageId: 'forbiddenImport',
            data: { message: boundaryError.message },
          });
        }
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') {
          const source = node.source.value;
          const srcError = checkSrcImport(source);
          if (srcError) {
            context.report({ node, messageId: 'srcImport', data: { message: srcError.message } });
          }
          const boundaryError = checkImport(source, filename);
          if (boundaryError) {
            context.report({
              node,
              messageId: 'forbiddenImport',
              data: { message: boundaryError.message },
            });
          }
        }
      },
    };
  },
};

const noVisualValues = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce semantic token usage - ban raw visual values outside packages/tokens',
      recommended: 'error',
    },
    schema: [],
    messages: {
      visualValue: '{{message}}',
    },
  },
  create(context) {
    const filename = context.filename;
    const TOKENS_PACKAGE_PATH = '/packages/tokens/';

    function isTokensPackage(filePath) {
      return filePath.includes(TOKENS_PACKAGE_PATH);
    }

    const TAILWIND_COLOR_PATTERN =
      /\b(bg|text|border|divide|ring|fill|stroke|decoration|accent|caret|outline|shadow|from|via|to|placeholder)-((slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-?\d{2,3})\b/g;
    const ARBITRARY_COLOR_PATTERN =
      /\b(bg|text|border|divide|ring|fill|stroke|decoration|accent|caret|outline|shadow|from|via|to|placeholder)-(\[#[0-9a-fA-F]{3,8}\]|\[rgb\([^)]+\)\]|\[hsl\([^)]+\)\]|\[oklch\([^)]+\)\]|\[hwb\([^)]+\)\]|\[lab\([^)]+\)\]|\[lch\([^)]+\)\])\b/g;
    const COLOR_FUNCTION_PATTERN = /\b(rgb|hsl|hwb|oklch|lab|lch)\([^)]+\)/g;
    const INLINE_STYLE_COLOR_PATTERN =
      /style\s*=\s*\{[^}]*(color|backgroundColor|borderColor|fill|stroke|outlineColor)\s*:\s*['"`][^'"`]+['"`]/g;

    function checkTailwindColors(value) {
      if (isTokensPackage(filename)) return [];
      const matches = value.matchAll(TAILWIND_COLOR_PATTERN);
      const errors = [];
      for (const match of matches) {
        errors.push({
          message: `Raw Tailwind color utility "${match[0]}" is forbidden. Use semantic tokens from @lazarus/tokens instead.`,
          match,
        });
      }
      return errors;
    }

    function checkArbitraryColors(value) {
      if (isTokensPackage(filename)) return [];
      const matches = value.matchAll(ARBITRARY_COLOR_PATTERN);
      const errors = [];
      for (const match of matches) {
        errors.push({
          message: `Arbitrary color value "${match[0]}" is forbidden. Use semantic tokens from @lazarus/tokens instead.`,
          match,
        });
      }
      return errors;
    }

    function checkColorFunctions(value) {
      if (isTokensPackage(filename)) return [];
      const matches = value.matchAll(COLOR_FUNCTION_PATTERN);
      const errors = [];
      for (const match of matches) {
        errors.push({
          message: `Color function "${match[0]}" is forbidden. Use semantic tokens from @lazarus/tokens instead.`,
          match,
        });
      }
      return errors;
    }

    function checkInlineStyles(value) {
      if (isTokensPackage(filename)) return [];
      const matches = value.matchAll(INLINE_STYLE_COLOR_PATTERN);
      const errors = [];
      for (const match of matches) {
        errors.push({
          message: `Inline style with visual property "${match[0]}" is forbidden. Use semantic tokens from @lazarus/tokens instead.`,
          match,
        });
      }
      return errors;
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          const value = node.value;
          const errors = [
            ...checkTailwindColors(value),
            ...checkArbitraryColors(value),
            ...checkColorFunctions(value),
            ...checkInlineStyles(value),
          ];
          for (const error of errors) {
            context.report({ node, messageId: 'visualValue', data: { message: error.message } });
          }
        }
      },
      JSXAttribute(node) {
        if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
          const value = node.value.value;
          const errors = [
            ...checkTailwindColors(value),
            ...checkArbitraryColors(value),
            ...checkColorFunctions(value),
          ];
          for (const error of errors) {
            context.report({ node, messageId: 'visualValue', data: { message: error.message } });
          }
        }
        if (node.value && node.value.type === 'JSXExpressionContainer') {
          const sourceCode = context.getSourceCode();
          const value = sourceCode.getText(node.value.expression);
          const errors = [
            ...checkTailwindColors(value),
            ...checkArbitraryColors(value),
            ...checkColorFunctions(value),
            ...checkInlineStyles(value),
          ];
          for (const error of errors) {
            context.report({
              node: node.value.expression,
              messageId: 'visualValue',
              data: { message: error.message },
            });
          }
        }
      },
      TemplateLiteral(node) {
        const sourceCode = context.getSourceCode();
        const value = sourceCode.getText(node);
        const errors = [
          ...checkTailwindColors(value),
          ...checkArbitraryColors(value),
          ...checkColorFunctions(value),
          ...checkInlineStyles(value),
        ];
        for (const error of errors) {
          context.report({ node, messageId: 'visualValue', data: { message: error.message } });
        }
      },
    };
  },
};

const noBannedPackages = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban packages that violate Lazarus anti-goals (terminal emulators, graph editors)',
      recommended: 'error',
    },
    schema: [],
    messages: {
      bannedPackage: 'Package "{{packageName}}" is banned. {{reason}}',
    },
  },
  create(context) {
    const BANNED_PACKAGES = [
      'xterm.js',
      'node-pty',
      '@xterm/',
      'reactflow',
      '@xyflow/react',
      '@xyflow/',
    ];

    function isBannedPackage(packageName) {
      return BANNED_PACKAGES.some((banned) => {
        if (banned.endsWith('/')) return packageName.startsWith(banned);
        return packageName === banned;
      });
    }

    return {
      Program() {
        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText();
        const importRegex = /from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
          const importSource = match[1];
          if (importSource.startsWith('.')) continue;
          const pkgName = importSource.split('/')[0];
          if (pkgName.startsWith('@')) {
            const scopedName = importSource.split('/').slice(0, 2).join('/');
            if (isBannedPackage(scopedName)) {
              context.report({
                loc: sourceCode.getLocFromIndex(match.index),
                messageId: 'bannedPackage',
                data: {
                  packageName: scopedName,
                  reason: 'Terminal emulators and graph editors are anti-goals per AGENTS.md',
                },
              });
            }
          } else if (isBannedPackage(pkgName)) {
            context.report({
              loc: sourceCode.getLocFromIndex(match.index),
              messageId: 'bannedPackage',
              data: {
                packageName: pkgName,
                reason: 'Terminal emulators and graph editors are anti-goals per AGENTS.md',
              },
            });
          }
        }
      },
    };
  },
};

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
        },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
    },
    rules: {
      // Disabled: redundant in TypeScript projects where `tsc` catches unresolved
      // imports, and it false-positives on NodeNext `.js` extension imports of `.ts` files.
      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            '**/test/**',
            '**/vitest.config.ts',
            '**/vitest.*.ts',
            'tools/**',
            '.github/**',
          ],
        },
      ],
      'import/no-self-import': 'error',
      'import/no-cycle': 'error',
      'import/no-useless-path-segments': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-empty-pattern': 'error',
      'no-irregular-whitespace': 'error',
      'no-unused-private-class-members': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
  {
    plugins: {
      lazarus: {
        rules: {
          'package-boundaries': packageBoundaries,
          'no-visual-values': noVisualValues,
          'no-banned-packages': noBannedPackages,
        },
      },
    },
    rules: {
      'lazarus/package-boundaries': 'error',
      'lazarus/no-visual-values': 'error',
      'lazarus/no-banned-packages': 'error',
    },
  },
  {
    ignores: [
      'dist/',
      '*.tsbuildinfo',
      'node_modules/',
      '.turbo/',
      'coverage/',
      '.next/',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
    ],
  },
]);
