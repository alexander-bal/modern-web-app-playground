import { oc } from '@orpc/contract';
import { z } from 'zod';
import { commonErrors } from '../shared/errors.js';
import {
  listProductsQuerySchema,
  productResponseSchema,
  productsListResponseSchema,
  searchProductsQuerySchema,
} from './schemas.js';

const list = oc
  .route({ method: 'GET', path: '/', summary: 'List all products' })
  .input(listProductsQuerySchema)
  .output(productsListResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
  });

const getBySlug = oc
  .route({ method: 'GET', path: '/by-slug/{slug}', summary: 'Get a product by slug' })
  .input(z.object({ slug: z.string() }))
  .output(productResponseSchema)
  .errors({
    NOT_FOUND: commonErrors.NOT_FOUND,
  });

const search = oc
  .route({ method: 'GET', path: '/search', summary: 'Search products' })
  .input(searchProductsQuerySchema)
  .output(productsListResponseSchema)
  .errors({
    VALIDATION_ERROR: commonErrors.VALIDATION_ERROR,
  });

export const productsOrpcContract = {
  list,
  getBySlug,
  search,
};
