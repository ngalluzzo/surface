import { describe, expect, test } from "bun:test";
import { buildIndex } from "../../../lib/test/helpers/builders";
import { emitIndex } from "../emitIndex";

describe("emitIndex", () => {
	test("simple index with btree", () => {
		const index = buildIndex({
			columns: ["email"],
			unique: false,
			method: "btree",
		});

		const result = emitIndex(index, "users");
		expect(result).toBe(
			'CREATE INDEX "users_email_idx" ON "users" USING btree ("email")',
		);
	});

	test("simple index without method (defaults to btree)", () => {
		const index = buildIndex({
			columns: ["username"],
			unique: false,
		});

		const result = emitIndex(index, "users");
		expect(result).toBe(
			'CREATE INDEX "users_username_idx" ON "users" USING btree ("username")',
		);
	});

	test("unique index", () => {
		const index = buildIndex({
			columns: ["email"],
			unique: true,
			method: "btree",
		});

		const result = emitIndex(index, "users");
		expect(result).toBe(
			'CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email")',
		);
	});

	test("composite index", () => {
		const index = buildIndex({
			columns: ["first_name", "last_name"],
			unique: false,
			method: "btree",
		});

		const result = emitIndex(index, "users");
		expect(result).toBe(
			'CREATE INDEX "users_first_name_last_name_idx" ON "users" USING btree ("first_name", "last_name")',
		);
	});

	test("index with hash method", () => {
		const index = buildIndex({
			columns: ["product_id"],
			unique: false,
			method: "hash",
		});

		const result = emitIndex(index, "products");
		expect(result).toBe(
			'CREATE INDEX "products_product_id_idx" ON "products" USING hash ("product_id")',
		);
	});

	test("index with gin method", () => {
		const index = buildIndex({
			columns: ["metadata"],
			unique: false,
			method: "gin",
		});

		const result = emitIndex(index, "documents");
		expect(result).toBe(
			'CREATE INDEX "documents_metadata_idx" ON "documents" USING gin ("metadata")',
		);
	});

	test("index with gist method", () => {
		const index = buildIndex({
			columns: ["location"],
			unique: false,
			method: "gist",
		});

		const result = emitIndex(index, "events");
		expect(result).toBe(
			'CREATE INDEX "events_location_idx" ON "events" USING gist ("location")',
		);
	});

	test("unique composite index", () => {
		const index = buildIndex({
			columns: ["order_id", "product_id"],
			unique: true,
			method: "btree",
		});

		const result = emitIndex(index, "order_items");
		expect(result).toBe(
			'CREATE UNIQUE INDEX "order_items_order_id_product_id_idx" ON "order_items" USING btree ("order_id", "product_id")',
		);
	});

	test("index without name uses default naming", () => {
		const index = buildIndex({
			columns: ["status"],
			unique: false,
		});

		const result = emitIndex(index, "orders");
		expect(result).toBe(
			'CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status")',
		);
	});

	test("index with explicit name", () => {
		const index = buildIndex({
			name: "custom_name",
			columns: ["email"],
			unique: true,
			method: "btree",
		});

		const result = emitIndex(index, "users");
		expect(result).toBe(
			'CREATE UNIQUE INDEX "custom_name" ON "users" USING btree ("email")',
		);
	});
});
