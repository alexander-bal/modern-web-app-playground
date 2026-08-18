-- Blocks the still-running old app from inserting another duplicate between the delete
-- below and the index build, which would abort the migration. Writers wait; readers do not.
LOCK TABLE "orders" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
-- Carts that duplicate an existing one for the same user, keeping the most recently
-- touched. Archived rather than dropped outright so the rows stay recoverable.
CREATE TABLE IF NOT EXISTS "orders_dup_carts_0026" AS
SELECT * FROM "orders" WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (
			PARTITION BY "user_id" ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
		) AS rn
		FROM "orders"
		WHERE "status" = 'cart' AND "user_id" IS NOT NULL
	) ranked WHERE rn > 1
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items_dup_carts_0026" AS
SELECT * FROM "order_items" WHERE "order_id" IN (SELECT "id" FROM "orders_dup_carts_0026");
--> statement-breakpoint
DELETE FROM "orders" WHERE "id" IN (SELECT "id" FROM "orders_dup_carts_0026");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_orders_user_cart" ON "orders" USING btree ("user_id") WHERE "orders"."user_id" IS NOT NULL AND "orders"."status" = 'cart';
