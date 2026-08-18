import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreExportsUsedInFile: {
    interface: true,
    type: true,
  },

  tags: ['-lintignore'],

  workspaces: {
    '.': {
      ignoreDependencies: [
        // Supplies the playwright CLI at the root for `pnpm exec playwright install`;
        // the test runner itself is @playwright/test in apps/web.
        'playwright',
      ],
    },

    'apps/backend': {
      entry: [
        // Temporal's worker resolves this path as a runtime string, not a static import.
        'src/shared/workflows/workflows.ts',
        // Ambient `declare module 'fastify'` augmentation for `request.user`; the compiler
        // picks it up from the project glob, so no file imports it.
        'src/infra/auth/auth.types.ts',
      ],

      ignoreDependencies: [
        // pino transport target, referenced by name in src/lib/logger.ts and src/config/server.ts.
        'pino-pretty',
        // Re-exported via the unified typescript-eslint package; direct entries satisfy ESLint's peer requirements.
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
      ],

      // Invoked as a CLI by the secrets:* scripts, never imported.
      ignoreBinaries: ['gitleaks'],
    },
  },
};

export default config;
