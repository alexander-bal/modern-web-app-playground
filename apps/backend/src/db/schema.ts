import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  customType,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Unified Database Schema
 * All tables are managed by this service and included in migrations.
 */

/**
 * PostgreSQL tsvector type for full-text search
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// =============================================================================
// Reference Tables
// =============================================================================

/**
 * Companies table schema
 * Stores company information for the practice management system
 */
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  status: varchar('status').notNull().default('onboarding'),
  billingSettings: jsonb('billing_settings').notNull().default('{}'),
  billingAddress: text('billing_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  billingInboundToken: text('billing_inbound_token').notNull().unique(),
  bobReferenceId: varchar('bob_reference_id'),
  companyDetails: jsonb('company_details').notNull().default('{}'),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

/**
 * User table schema (Better Auth core + preserved business fields)
 * Stores user accounts; credentials live in the `account` table.
 */
export const user = pgTable('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: varchar('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  isAdmin: boolean('is_admin').default(false),
  adminRole: varchar('admin_role'),
  adminCompanyIds: text('admin_company_ids').array(),
  phone: varchar('phone', { length: 30 }),
  locale: varchar('locale', { length: 10 }).default('en-GB'),
  config: jsonb('config').notNull().default('{}'),
  isOptedInToMarketing: boolean('is_opted_in_to_marketing').notNull().default(false),
  plainCustomerId: varchar('plain_customer_id'),
  plainLastSyncedAt: timestamp('plain_last_synced_at', { withTimezone: true }),
});

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

/**
 * Session table schema (Better Auth)
 * Stores active user sessions for cookie-based authentication
 */
export const session = pgTable(
  'session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => [
    uniqueIndex('idx_session_token').on(table.token),
    index('idx_session_user_id').on(table.userId),
  ]
);

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

/**
 * Account table schema (Better Auth)
 * Stores one row per auth method linked to a user (email/password credential, OAuth, etc.)
 */
export const account = pgTable(
  'account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_account_user_id').on(table.userId)]
);

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

/**
 * Verification table schema (Better Auth)
 * Stores short-lived tokens for email verification, password reset, etc.
 */
export const verification = pgTable('verification', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

// =============================================================================
// Billing Tables
// =============================================================================

/**
 * Orders table schema
 * Stores orders without foreign key dependencies (standalone entity)
 * Also used for carts (status='cart') with userId or cartToken for identification
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    orderNumber: text('order_number').notNull(),
    referenceNumber: text('reference_number'),
    orderDate: date('order_date').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    currency: varchar('currency', { length: 3 }).notNull(),
    subtotal: text('subtotal').notNull(), // NUMERIC(15,2) stored as text for precision
    taxAmount: text('tax_amount').notNull().default('0.00'),
    discountAmount: text('discount_amount').notNull().default('0.00'),
    shippingAmount: text('shipping_amount').notNull().default('0.00'),
    totalAmount: text('total_amount').notNull(), // NUMERIC(15,2) stored as text for precision
    shippingAddress: text('shipping_address'),
    billingAddress: text('billing_address'),
    paymentTerms: varchar('payment_terms', { length: 64 }),
    notes: text('notes'),
    customerNotes: text('customer_notes'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paymentTransactionId: text('payment_transaction_id'),
    userId: uuid('user_id'),
    cartToken: uuid('cart_token'),
  },
  (table) => [
    check(
      'orders_status_check',
      sql`${table.status} IN ('draft', 'confirmed', 'processing', 'shipped', 'fulfilled', 'paid', 'cancelled', 'cart')`
    ),
    uniqueIndex('idx_orders_order_number').on(table.orderNumber),
    uniqueIndex('idx_orders_cart_token')
      .on(table.cartToken)
      .where(sql`${table.cartToken} IS NOT NULL`),
    index('idx_orders_status').on(table.status),
    index('idx_orders_order_date').on(table.orderDate),
    index('idx_orders_payment_transaction_id').on(table.paymentTransactionId),
    index('idx_orders_user_id').on(table.userId),
    // A user has at most one open cart; without this, concurrent add-to-cart requests
    // each insert their own and the extra one outlives checkout.
    uniqueIndex('idx_orders_user_cart')
      .on(table.userId)
      .where(sql`${table.userId} IS NOT NULL AND ${table.status} = 'cart'`),
  ]
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

// =============================================================================
// Product Tables
// =============================================================================

/**
 * Products table schema
 * Stores product catalog for the e-commerce system
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sku: text('sku').notNull(),
    description: text('description'),
    shortDescription: text('short_description'),
    category: text('category'),
    tags: jsonb('tags').$type<string[] | null>(),
    imageUrl: text('image_url'),
    currency: varchar('currency', { length: 3 }).notNull(),
    price: numeric('price', { precision: 15, scale: 2 }).notNull(),
    compareAtPrice: numeric('compare_at_price', { precision: 15, scale: 2 }),
    costPrice: numeric('cost_price', { precision: 15, scale: 2 }),
    weight: numeric('weight', { precision: 15, scale: 2 }),
    width: numeric('width', { precision: 15, scale: 2 }),
    height: numeric('height', { precision: 15, scale: 2 }),
    length: numeric('length', { precision: 15, scale: 2 }),
    searchVector: tsvector('search_vector'),
  },
  (table) => [
    check('products_status_check', sql`${table.status} IN ('draft', 'active', 'archived')`),
    uniqueIndex('idx_products_sku').on(table.sku),
    uniqueIndex('idx_products_slug').on(table.slug),
    index('idx_products_status').on(table.status),
    index('idx_products_category').on(table.category),
  ]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

/**
 * Order items table schema
 * Stores individual line items for orders and carts
 * Snapshots product details at the time of addition for historical accuracy
 */
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: numeric('quantity', { precision: 10, scale: 0 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    productName: text('product_name').notNull(),
    productSku: text('product_sku').notNull(),
    productImageUrl: text('product_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('order_items_quantity_check', sql`${table.quantity}::int > 0`),
    uniqueIndex('idx_order_items_order_product').on(table.orderId, table.productId),
    index('idx_order_items_order_id').on(table.orderId),
  ]
);

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// =============================================================================
// Address Tables
// =============================================================================

/**
 * Addresses table schema
 * Stores saved shipping/billing addresses for authenticated users
 */
export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    addressLine1: text('address_line_1').notNull(),
    addressLine2: text('address_line_2'),
    city: text('city').notNull(),
    state: text('state'),
    postalCode: text('postal_code').notNull(),
    countryCode: char('country_code', { length: 2 }).notNull(),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('addresses_user_id_idx').on(table.userId),
    uniqueIndex('addresses_one_default_per_user_idx')
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
  ]
);

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
