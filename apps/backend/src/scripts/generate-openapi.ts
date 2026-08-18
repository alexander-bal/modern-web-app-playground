/**
 * OpenAPI Specification Generator
 *
 * Generates a complete OpenAPI 3.1 specification from the oRPC module contracts
 * (see `config/openapi.ts`, the single source of truth also used to serve `/docs`).
 *
 * Usage:
 *   pnpm openapi:generate                          # Generate the spec
 *   pnpm openapi:generate --yaml                   # Also generate YAML format
 *
 * Output directory: generated/openapi/
 *   - openapi.json
 *   - openapi.yaml (with --yaml)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { OpenAPIV3_1 } from 'openapi-types';
import { stringify as yamlStringify } from 'yaml';
import { generateOpenApiSpec } from '../config/openapi.js';

const API_INFO = {
  title: 'Mercado E-commerce API',
  description: `
REST API for the Mercado E-commerce System.

## Authentication

Endpoints that require authentication use a session cookie (\`sid\`), set by \`POST /api/auth/login\`
or \`POST /api/auth/register\`.

## Error Handling

Endpoints return a flat error body: \`{ "error": string, "details"?: ... }\`. See each operation's
declared error responses for the status codes it can return.

## Rate Limiting

API requests are rate-limited to 100 requests per minute per client.
`.trim(),
  version: '1.0.0',
  contact: {
    name: 'Mercado API Support',
    email: 'api-support@mercado.io',
  },
  license: {
    name: 'Proprietary',
    url: 'https://mercado.io/terms',
  },
};

const SERVERS = [
  {
    url: 'https://api.mercado.io',
    description: 'Production server',
  },
  {
    url: 'http://localhost:3000',
    description: 'Local development server',
  },
];

function toYaml(spec: OpenAPIV3_1.Document): string {
  return yamlStringify(spec, { lineWidth: 0 });
}

const DEFAULT_OUTPUT_DIR = 'generated/openapi';

async function main() {
  const args = process.argv.slice(2);
  const outputYaml = args.includes('--yaml');
  const outputDir =
    args.find((arg) => arg.startsWith('--output='))?.split('=')[1] || DEFAULT_OUTPUT_DIR;

  console.log('Generating OpenAPI specification...');

  try {
    const spec = await generateOpenApiSpec({ info: API_INFO, servers: SERVERS });

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      throw new Error('Generated spec has no paths. Check contract configuration.');
    }

    const pathCount = Object.keys(spec.paths).length;
    console.log(`Generated spec with ${pathCount} paths`);

    await mkdir(outputDir, { recursive: true });

    const jsonPath = resolve(outputDir, 'openapi.json');
    await writeFile(jsonPath, JSON.stringify(spec, null, 2), 'utf-8');
    console.log(`Written: ${jsonPath}`);

    if (outputYaml) {
      const yamlContent = toYaml(spec);
      const yamlPath = resolve(outputDir, 'openapi.yaml');
      await writeFile(yamlPath, yamlContent, 'utf-8');
      console.log(`Written: ${yamlPath}`);
    }

    console.log('\nOpenAPI generation complete!');
    console.log('\nNext steps:');
    console.log(`  - Validate: npx @redocly/cli lint ${jsonPath}`);
    console.log(`  - View docs: npx @redocly/cli preview-docs ${jsonPath}`);
  } catch (error) {
    console.error('Failed to generate OpenAPI spec:', error);
    process.exit(1);
  }
}

void main();
