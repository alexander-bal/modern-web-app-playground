import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreExportsUsedInFile: {
    interface: true,
    type: true,
  },

  tags: ['-lintignore'],

  workspaces: {
    'apps/backend': {
      // Temporal's worker resolves this path as a runtime string, not a static import.
      entry: ['src/shared/workflows/workflows.ts'],

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
