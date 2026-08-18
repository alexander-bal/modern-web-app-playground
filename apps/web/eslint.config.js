import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Bindings prefixed with `_` are deliberately unused — Playwright fixtures are often
// destructured only for their setup side effect.
const unusedVarsRule = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
};

export default defineConfig([
  globalIgnores(['dist', 'public/mockServiceWorker.js']),
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['e2e/**', 'tests-integration/**'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: unusedVarsRule,
  },
  {
    files: ['e2e/**/*.ts', 'tests-integration/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: unusedVarsRule,
  },
]);
