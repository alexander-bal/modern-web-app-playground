import { beforeAll, describe, expect, it } from 'vitest';
import type { OpenAPIV3_1 } from 'openapi-types';
import { generateOpenApiSpec } from './openapi.js';

describe('generateOpenApiSpec', () => {
  let doc: OpenAPIV3_1.Document;

  beforeAll(async () => {
    doc = await generateOpenApiSpec({
      info: { title: 'Mercado API', version: '9.9.9' },
      servers: [{ url: 'https://api.example.test' }],
    });
  });

  function operationsFor(path: string): OpenAPIV3_1.OperationObject[] {
    const pathItem = doc.paths?.[path];
    expect(pathItem, `expected the spec to describe ${path}`).toBeDefined();
    return Object.values(pathItem as Record<string, OpenAPIV3_1.OperationObject>);
  }

  function securityNamesFor(path: string): string[][] {
    return operationsFor(path).map((operation) =>
      (operation.security ?? []).flatMap((requirement) => Object.keys(requirement))
    );
  }

  it('passes the caller-supplied info and servers through', () => {
    expect(doc.info).toMatchObject({ title: 'Mercado API', version: '9.9.9' });
    expect(doc.servers).toEqual([{ url: 'https://api.example.test' }]);
  });

  it('declares the Better Auth session cookie as the security scheme', () => {
    expect(doc.components?.securitySchemes?.['SessionCookie']).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
    });
  });

  it('mounts each module under its Fastify prefix', () => {
    const paths = Object.keys(doc.paths ?? {});

    for (const prefix of [
      '/api/orders',
      '/api/products',
      '/api/cart',
      '/api/v1/addresses',
      '/api/checkout',
    ]) {
      expect(
        paths.some((path) => path.startsWith(prefix)),
        `expected at least one path under ${prefix}`
      ).toBe(true);
    }
  });

  it.each(['/api/orders', '/api/checkout', '/api/v1/addresses'])(
    'requires the session cookie on every operation under %s',
    (prefix) => {
      const guarded = Object.keys(doc.paths ?? {}).filter((path) => path.startsWith(prefix));
      expect(guarded.length).toBeGreaterThan(0);

      for (const path of guarded) {
        for (const names of securityNamesFor(path)) {
          expect(names, `${path} should require the session cookie`).toEqual(['SessionCookie']);
        }
      }
    }
  );

  it('leaves the public product catalogue unauthenticated', () => {
    const productPaths = Object.keys(doc.paths ?? {}).filter((path) =>
      path.startsWith('/api/products')
    );
    expect(productPaths.length).toBeGreaterThan(0);

    for (const path of productPaths) {
      for (const names of securityNamesFor(path)) {
        expect(names, `${path} should be public`).toEqual([]);
      }
    }
  });

  it('guards cart merge while leaving the rest of the cart open to guests', () => {
    for (const names of securityNamesFor('/api/cart/merge')) {
      expect(names).toEqual(['SessionCookie']);
    }

    const otherCartPaths = Object.keys(doc.paths ?? {}).filter(
      (path) => path.startsWith('/api/cart') && path !== '/api/cart/merge'
    );
    expect(otherCartPaths.length).toBeGreaterThan(0);

    for (const path of otherCartPaths) {
      for (const names of securityNamesFor(path)) {
        expect(names, `${path} should be reachable by a guest`).toEqual([]);
      }
    }
  });

  it('tags every operation so the docs group by module', () => {
    expect(doc.tags?.map((tag) => tag.name)).toEqual([
      'Orders',
      'Products',
      'Cart',
      'Addresses',
      'Checkout',
    ]);

    for (const path of Object.keys(doc.paths ?? {})) {
      for (const operation of operationsFor(path)) {
        expect(operation.tags?.length, `${path} should carry a tag`).toBeGreaterThan(0);
      }
    }
  });
});
