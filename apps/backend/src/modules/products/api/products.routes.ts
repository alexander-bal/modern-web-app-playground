import { productsOrpcContract } from '@mercado/api-contracts';
import { implement } from '@orpc/server';
import { createModuleLogger } from '../../../lib/logger.js';
import { ProductNotFoundError, productsService } from '../services/products.service.js';

const logger = createModuleLogger('products');

const os = implement(productsOrpcContract);

const list = os.list.handler(async ({ input }) => {
  try {
    return await productsService.list(input);
  } catch (error) {
    logger.error({ error, query: input }, 'Unexpected error in list products route');
    throw error;
  }
});

const getBySlug = os.getBySlug.handler(async ({ input, errors }) => {
  try {
    return await productsService.getBySlug(input.slug);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      throw errors.NOT_FOUND({ data: { error: error.message } });
    }

    logger.error({ error, slug: input.slug }, 'Unexpected error in get product by slug route');
    throw error;
  }
});

const search = os.search.handler(async ({ input }) => {
  try {
    return await productsService.search(input);
  } catch (error) {
    logger.error({ error, query: input }, 'Unexpected error in search products route');
    throw error;
  }
});

export const productsOrpcRouter = os.router({
  list,
  getBySlug,
  search,
});
