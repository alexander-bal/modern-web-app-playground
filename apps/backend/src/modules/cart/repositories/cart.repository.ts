import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { db, orderItems, orders } from '../../../db/index.js';
import type { OrderItem } from '../../../db/schema.js';

/** Matches the idx_orders_user_cart partial unique index. */
const userCartPredicate = sql`${orders.userId} IS NOT NULL AND ${orders.status} = 'cart'`;

/**
 * Find cart (order with status='cart') by user ID
 * @param userId User ID
 * @param database Database instance
 * @returns Cart order or null if not found
 */
export async function findCartByUserId(userId: string, database: Database = db) {
  const results = await database
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'cart')))
    .limit(1);

  return results[0] || null;
}

/**
 * Find order by user ID (any status, most recent first)
 * Used for checkout idempotency - finds cart or already-confirmed order
 * @param userId User ID
 * @param database Database instance
 * @returns Order or null if not found
 */
export async function findOrderByUserId(userId: string, database: Database = db) {
  const results = await database
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(1);

  return results[0] || null;
}

/**
 * Find cart (order with status='cart') by cart token
 * @param cartToken Cart token
 * @param database Database instance
 * @returns Cart order or null if not found
 */
export async function findCartByToken(cartToken: string, database: Database = db) {
  const results = await database
    .select()
    .from(orders)
    .where(and(eq(orders.cartToken, cartToken), eq(orders.status, 'cart')))
    .limit(1);

  return results[0] || null;
}

/**
 * Create a new cart order
 * @param data Cart order data
 * @param database Database instance
 * @returns Created cart order, or null if the user already gained one concurrently
 */
export async function createCartOrder(
  data: {
    userId?: string | null;
    cartToken?: string | null;
    currency: string;
    orderNumber: string;
    orderDate: string;
  },
  database: Database = db
) {
  const results = await database
    .insert(orders)
    .values({
      status: 'cart',
      userId: data.userId || null,
      cartToken: data.cartToken || null,
      currency: data.currency,
      orderNumber: data.orderNumber,
      orderDate: data.orderDate,
      subtotal: '0.00',
      totalAmount: '0.00',
      taxAmount: '0.00',
      discountAmount: '0.00',
      shippingAmount: '0.00',
    })
    .onConflictDoNothing({ target: orders.userId, where: userCartPredicate })
    .returning();

  return results[0] ?? null;
}

/**
 * Find all items in a cart
 * @param orderId Order ID
 * @param database Database instance
 * @returns Array of order items
 */
export async function findCartItems(
  orderId: string,
  database: Database = db
): Promise<OrderItem[]> {
  const results = await database.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  return results;
}

/**
 * Upsert a cart item (insert or update quantity if product already in cart)
 * @param orderId Order ID
 * @param item Item data
 * @param database Database instance
 * @returns Upserted order item
 */
export async function upsertCartItem(
  orderId: string,
  item: {
    productId: string;
    quantity: number;
    unitPrice: string;
    currency: string;
    productName: string;
    productSku: string;
    productImageUrl: string | null;
  },
  database: Database = db
): Promise<OrderItem> {
  const results = await database
    .insert(orderItems)
    .values({
      orderId,
      productId: item.productId,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice,
      currency: item.currency,
      productName: item.productName,
      productSku: item.productSku,
      productImageUrl: item.productImageUrl,
    })
    .onConflictDoUpdate({
      target: [orderItems.orderId, orderItems.productId],
      set: {
        quantity: sql`${orderItems.quantity}::numeric + ${item.quantity}`,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  if (!results[0]) {
    throw new Error('Failed to upsert cart item');
  }

  return results[0];
}

/**
 * Update cart item quantity
 * @param itemId Item ID
 * @param orderId Order ID (for security check)
 * @param quantity New quantity
 * @param database Database instance
 * @returns Updated order item or null if not found
 */
export async function updateCartItemQuantity(
  itemId: string,
  orderId: string,
  quantity: number,
  database: Database = db
): Promise<OrderItem | null> {
  const results = await database
    .update(orderItems)
    .set({
      quantity: quantity.toString(),
      updatedAt: sql`now()`,
    })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning();

  return results[0] || null;
}

/**
 * Delete a single cart item
 * @param itemId Item ID
 * @param orderId Order ID (for security check)
 * @param database Database instance
 * @returns Deleted order item or null if not found
 */
export async function deleteCartItem(
  itemId: string,
  orderId: string,
  database: Database = db
): Promise<OrderItem | null> {
  const results = await database
    .delete(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning();

  return results[0] || null;
}

/**
 * Delete all items in a cart
 * @param orderId Order ID
 * @param database Database instance
 * @returns Number of deleted items
 */
export async function deleteAllCartItems(
  orderId: string,
  database: Database = db
): Promise<number> {
  const results = await database
    .delete(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .returning();

  return results.length;
}

/**
 * Delete cart order
 * @param orderId Order ID
 * @param database Database instance
 */
export async function deleteCartOrder(orderId: string, database: Database = db): Promise<void> {
  await database.delete(orders).where(eq(orders.id, orderId));
}

/**
 * Update cart totals based on items
 * @param orderId Order ID
 * @param database Database instance
 */
export async function updateCartTotals(orderId: string, database: Database = db): Promise<void> {
  // Summed in the UPDATE rather than read-then-written, so concurrent adds to the same
  // cart cannot overwrite each other with a subtotal computed before the other's item.
  const subtotal = sql`COALESCE((
    SELECT SUM(${orderItems.unitPrice} * ${orderItems.quantity})
    FROM ${orderItems}
    WHERE ${orderItems.orderId} = ${orderId}
  ), 0)::numeric(15,2)::text`;

  await database
    .update(orders)
    .set({
      subtotal,
      totalAmount: subtotal,
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, orderId));
}

/**
 * Reassign guest cart to authenticated user
 * @param orderId Order ID
 * @param userId User ID
 * @param database Database instance
 */
export async function reassignGuestCart(
  orderId: string,
  userId: string,
  database: Database = db
): Promise<void> {
  await database
    .update(orders)
    .set({
      userId,
      cartToken: null,
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, orderId));
}
