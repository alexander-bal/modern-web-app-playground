import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/index.js';
import { addresses, db } from '../../../db/index.js';
import type { Address, NewAddressEntity } from '../domain/address.entity.js';

export async function findAddressesByUserId(
  userId: string,
  database: Database = db
): Promise<Address[]> {
  return database
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), asc(addresses.createdAt));
}

export async function findAddressByIdAndUserId(
  id: string,
  userId: string,
  database: Database = db
): Promise<Address | null> {
  const results = await database
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
  return results[0] ?? null;
}

export async function countAddressesByUserId(
  userId: string,
  database: Database = db
): Promise<number> {
  const results = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(addresses)
    .where(eq(addresses.userId, userId));
  return results[0]?.count ?? 0;
}

export async function insertAddress(
  data: NewAddressEntity,
  database: Database = db
): Promise<Address> {
  const results = await database.insert(addresses).values(data).returning();
  if (!results[0]) throw new Error('Failed to insert address');
  return results[0];
}

export async function clearDefaultForUser(userId: string, database: Database = db): Promise<void> {
  await database.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
}

export async function updateAddressById(
  id: string,
  userId: string,
  data: Partial<Omit<NewAddressEntity, 'userId'>>,
  database: Database = db
): Promise<Address | null> {
  const results = await database
    .update(addresses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .returning();
  return results[0] ?? null;
}

export async function deleteAddressById(
  id: string,
  userId: string,
  database: Database = db
): Promise<boolean> {
  const results = await database
    .delete(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .returning();
  return results.length > 0;
}

export async function hasDefaultAddress(userId: string, database: Database = db): Promise<boolean> {
  const results = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(addresses)
    .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true)));
  return (results[0]?.count ?? 0) > 0;
}
