import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.pnpm-store/**',
      'local/**',
      '*.config.js',
      '*.config.ts',
      'vitest.setup.ts',
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript configuration
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked, eslintConfigPrettier],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Do not add any rules here
    },
  },

  // Architectural boundaries between modules/*, shared/*, and process composition roots
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: true },
      // worker.ts/workflows.ts are Temporal process-wiring entrypoints (same role as app.ts/
      // server.ts, which already sit outside shared/ and modules/) — excluded here so they
      // aren't classified as `shared` and caught by the shared-must-stay-domain-agnostic policy.
      'boundaries/ignore': ['src/shared/workflows/worker.ts', 'src/shared/workflows/workflows.ts'],
      'boundaries/elements': [
        { type: 'shared', pattern: 'shared/*' },
        { type: 'module', pattern: 'modules/*', capture: ['module'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { type: 'module' } } },
              message:
                'shared/ must stay domain-agnostic (see .claude/rules/shared-layer.md) — it cannot import from modules/*.',
            },
            {
              from: { element: { type: 'module' } },
              disallow: { to: { element: { type: 'module', fileInternalPath: '!index.ts' } } },
              message: "Cross-module imports must go through the target module's index.ts.",
            },
            {
              from: { element: { type: 'module' } },
              allow: {
                to: { element: { type: 'module', captured: { module: '{{ from.module }}' } } },
              },
            },
          ],
        },
      ],
    },
  },

  // Test-specific overrides
  {
    files: ['**/*.test.ts'],
    rules: {
      // Allow 'any' from response.json() and JSON.parse() in tests for ergonomics over strict typing
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  }
);
