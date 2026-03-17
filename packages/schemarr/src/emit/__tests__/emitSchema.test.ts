import { describe, expect, test } from "bun:test";
import { postgresDialect } from "../../dialect/postgres";
import {
	buildColumn,
	buildEnum,
	buildForeignKey,
	buildIndex,
	buildPkColumn,
	buildPrimaryKey,
	buildSchema,
	buildTable,
	colType,
} from "../../lib/test/helpers/builders";
import type { SchemaIR } from "../../lib/types";
import { emitSchema } from "../emitSchema";

describe("emitSchema", () => {
	test("emits simple schema with one table", () => {
		const schema: SchemaIR = buildSchema({
			name: "test_schema",
			tables: [
				buildTable({
					name: "users",
					columns: [
						buildPkColumn({ name: "id" }),
						buildColumn({
							name: "email",
							type: colType.text(),
							nullable: false,
						}),
					],
					constraints: [buildPrimaryKey(["id"], "users_pkey")],
					indexes: [],
				}),
			],
			enums: [],
		});

		const result = emitSchema(schema, postgresDialect);
		expect(result).toContain('CREATE TABLE "users"');
		expect(result).toContain('"id" UUID NOT NULL');
		expect(result).toContain('"email" TEXT NOT NULL');
		expect(result).toContain('CONSTRAINT "users_pkey" PRIMARY KEY ("id")');
	});

	test("emits enums before tables", () => {
		const schema: SchemaIR = buildSchema({
			name: "test_schema",
			tables: [
				buildTable({
					name: "users",
					columns: [
						buildPkColumn({ name: "id" }),
						buildColumn({
							name: "status",
							type: colType.enumRef("user_status"),
							nullable: false,
						}),
					],
					constraints: [buildPrimaryKey(["id"], "users_pkey")],
					indexes: [],
				}),
			],
			enums: [
				buildEnum({ name: "user_status", values: ["active", "inactive"] }),
			],
		});

		const result = emitSchema(schema, postgresDialect);
		expect(result).toContain('CREATE TYPE "user_status"');
		expect(result).toContain('CREATE TABLE "users"');
		const enumPos = result.indexOf('CREATE TYPE "user_status"');
		const tablePos = result.indexOf('CREATE TABLE "users"');
		expect(enumPos).toBeLessThan(tablePos);
	});

	test("emits tables with FK in correct order", () => {
		const schema: SchemaIR = buildSchema({
			name: "test_schema",
			tables: [
				buildTable({
					name: "posts",
					columns: [
						buildPkColumn({ name: "id" }),
						buildColumn({
							name: "author_id",
							type: colType.uuid(),
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
				}),
				buildTable({
					name: "users",
					columns: [
						buildPkColumn({ name: "id" }),
						buildColumn({
							name: "email",
							type: colType.text(),
							nullable: false,
						}),
					],
					constraints: [buildPrimaryKey(["id"], "users_pkey")],
					indexes: [],
				}),
			],
			enums: [],
		});

		const result = emitSchema(schema, postgresDialect);
		const usersPos = result.indexOf('CREATE TABLE "users"');
		const postsPos = result.indexOf('CREATE TABLE "posts"');
		expect(usersPos).toBeLessThan(postsPos);
	});

	test("emits indexes after tables", () => {
		const schema: SchemaIR = buildSchema({
			name: "test_schema",
			tables: [
				buildTable({
					name: "users",
					columns: [
						buildPkColumn({ name: "id" }),
						buildColumn({
							name: "email",
							type: colType.text(),
							nullable: false,
						}),
					],
					constraints: [buildPrimaryKey(["id"], "users_pkey")],
					indexes: [
						buildIndex({
							name: "users_email_idx",
							columns: ["email"],
							unique: true,
							method: "btree",
						}),
					],
				}),
			],
			enums: [],
		});

		const result = emitSchema(schema, postgresDialect);
		const tablePos = result.indexOf('CREATE TABLE "users"');
		const indexPos = result.indexOf("CREATE UNIQUE INDEX");
		expect(tablePos).toBeLessThan(indexPos);
		expect(result).toContain(
			'CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email")',
		);
	});

	test("separates statements with double newlines", () => {
		const schema: SchemaIR = buildSchema({
			name: "test_schema",
			tables: [
				buildTable({
					name: "users",
					columns: [buildPkColumn({ name: "id" })],
					constraints: [buildPrimaryKey(["id"], "users_pkey")],
					indexes: [],
				}),
				buildTable({
					name: "posts",
					columns: [buildPkColumn({ name: "id" })],
					constraints: [buildPrimaryKey(["id"], "posts_pkey")],
					indexes: [],
				}),
			],
			enums: [],
		});

		const result = emitSchema(schema, postgresDialect);
		expect(result).toContain("\n\n");
	});
});
