import { describe, expect, test } from "bun:test";
import {
	buildCheck,
	buildColumn,
	buildForeignKey,
	buildPrimaryKey,
	buildTable,
	buildUnique,
} from "../../../lib/test/helpers/builders";
import type { TableIR } from "../../../lib/types";
import { emitTable } from "../emitTable";

describe("emitTable", () => {
	test("minimal table with one column", () => {
		const table: TableIR = buildTable({
			name: "users",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				}),
			],
			constraints: [buildPrimaryKey(["id"], "users_pkey")],
			indexes: [],
		});

		const result = emitTable(table);
		expect(result).toBe(
			'CREATE TABLE "users" (\n  "id" UUID NOT NULL,\n  CONSTRAINT "users_pkey" PRIMARY KEY ("id")\n);',
		);
	});

	test("table with multiple columns", () => {
		const table: TableIR = buildTable({
			name: "users",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				}),
				buildColumn({
					name: "username",
					type: { kind: "text" },
					nullable: false,
				}),
				buildColumn({ name: "email", type: { kind: "text" }, nullable: true }),
			],
			constraints: [buildPrimaryKey(["id"], "users_pkey")],
			indexes: [],
		});

		const result = emitTable(table);
		expect(result).toBe(
			'CREATE TABLE "users" (\n  "id" UUID NOT NULL,\n  "username" TEXT NOT NULL,\n  "email" TEXT,\n  CONSTRAINT "users_pkey" PRIMARY KEY ("id")\n);',
		);
	});

	test("table with unique constraint", () => {
		const table: TableIR = buildTable({
			name: "users",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				}),
				buildColumn({ name: "email", type: { kind: "text" }, nullable: true }),
			],
			constraints: [
				buildPrimaryKey(["id"], "users_pkey"),
				buildUnique(["email"], "users_email_key"),
			],
			indexes: [],
		});

		const result = emitTable(table);
		expect(result).toBe(
			'CREATE TABLE "users" (\n  "id" UUID NOT NULL,\n  "email" TEXT,\n  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),\n  CONSTRAINT "users_email_key" UNIQUE ("email")\n);',
		);
	});

	test("table with foreign key constraint", () => {
		const table: TableIR = buildTable({
			name: "posts",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				}),
				buildColumn({ name: "title", type: { kind: "text" }, nullable: false }),
				buildColumn({
					name: "author_id",
					type: { kind: "uuid" },
					nullable: false,
				}),
			],
			constraints: [
				buildPrimaryKey(["id"], "posts_pkey"),
				buildForeignKey({
					name: "posts_author_id_fkey",
					columns: ["author_id"],
					refTable: "users",
					refColumns: ["id"],
				}),
			],
			indexes: [],
		});

		const result = emitTable(table);
		expect(result).toBe(
			'CREATE TABLE "posts" (\n  "id" UUID NOT NULL,\n  "title" TEXT NOT NULL,\n  "author_id" UUID NOT NULL,\n  CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),\n  CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id")\n);',
		);
	});

	test("table with check constraint", () => {
		const table: TableIR = buildTable({
			name: "products",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				}),
				buildColumn({
					name: "price",
					type: { kind: "double_precision" },
					nullable: true,
				}),
			],
			constraints: [
				buildPrimaryKey(["id"], "products_pkey"),
				buildCheck("price > 0", "products_price_gte"),
			],
			indexes: [],
		});

		const result = emitTable(table);
		expect(result).toBe(
			'CREATE TABLE "products" (\n  "id" UUID NOT NULL,\n  "price" DOUBLE PRECISION,\n  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),\n  CONSTRAINT "products_price_gte" CHECK (price > 0)\n);',
		);
	});

	test("table matching fixture minimal.sql", () => {
		const table: TableIR = buildTable({
			name: "all_types",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				}),
				buildColumn({ name: "label", type: { kind: "text" }, nullable: true }),
				buildColumn({
					name: "short_code",
					type: { kind: "varchar", maxLength: 10 },
				}),
				buildColumn({ name: "age", type: { kind: "integer" }, nullable: true }),
				buildColumn({
					name: "score",
					type: { kind: "double_precision" },
					nullable: true,
				}),
				buildColumn({
					name: "is_active",
					type: { kind: "boolean" },
					nullable: true,
				}),
				buildColumn({
					name: "birth_date",
					type: { kind: "date" },
					nullable: true,
				}),
				buildColumn({
					name: "created_at",
					type: { kind: "timestamptz" },
					nullable: true,
				}),
				buildColumn({
					name: "metadata",
					type: { kind: "jsonb" },
					nullable: true,
				}),
				buildColumn({
					name: "tags",
					type: { kind: "array", inner: { kind: "text" } },
					nullable: true,
				}),
			],
			constraints: [buildPrimaryKey(["id"], "all_types_pkey")],
			indexes: [],
		});

		const result = emitTable(table);
		expect(result).toBe(
			'CREATE TABLE "all_types" (\n  "id" UUID NOT NULL,\n  "label" TEXT,\n  "short_code" VARCHAR(10),\n  "age" INTEGER,\n  "score" DOUBLE PRECISION,\n  "is_active" BOOLEAN,\n  "birth_date" DATE,\n  "created_at" TIMESTAMPTZ,\n  "metadata" JSONB,\n  "tags" TEXT[],\n  CONSTRAINT "all_types_pkey" PRIMARY KEY ("id")\n);',
		);
	});
});
