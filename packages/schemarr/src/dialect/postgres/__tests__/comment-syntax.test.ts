import { describe, expect, test } from "bun:test";
import { emitSchema } from "../../../emit/emitSchema";
import {
	buildColumn,
	buildPrimaryKey,
	buildTable,
} from "../../../lib/test/helpers/builders";
import type { TableIR } from "../../../lib/types";
import { emitTable } from "../emitTable";
import { postgresDialect } from "../index";

describe("Column comments (PostgreSQL syntax) - Issue #3", () => {
	test("should emit separate COMMENT ON COLUMN statements", () => {
		const table: TableIR = buildTable({
			name: "users",
			columns: [
				buildColumn({
					name: "email",
					type: { kind: "text" },
					nullable: false,
					comment: "User email address",
				}),
			],
			constraints: [buildPrimaryKey(["email"], "users_pkey")],
			indexes: [],
		});

		const result = emitTable(table);

		// Should NOT include inline COMMENT (current behavior is wrong)
		expect(result).not.toContain("COMMENT");
	});

	test("should emit full schema with COMMENT ON COLUMN statements", () => {
		const table: TableIR = buildTable({
			name: "users",
			columns: [
				buildColumn({
					name: "email",
					type: { kind: "text" },
					nullable: false,
					comment: "User email address",
				}),
			],
			constraints: [buildPrimaryKey(["email"], "users_pkey")],
			indexes: [],
		});

		const fullSchema = emitSchema(
			{ name: "test", tables: [table], enums: [] },
			postgresDialect,
		);

		// Should emit separate COMMENT ON COLUMN statement
		expect(fullSchema).toContain('COMMENT ON COLUMN "users"."email"');
		expect(fullSchema).toContain("IS 'User email address'");
	});

	test("should handle comments with special characters", () => {
		const table: TableIR = buildTable({
			name: "products",
			columns: [
				buildColumn({
					name: "name",
					type: { kind: "text" },
					nullable: false,
					comment: "Product's name with quotes",
				}),
			],
			constraints: [],
			indexes: [],
		});

		const result = emitSchema(
			{ name: "test", tables: [table], enums: [] },
			postgresDialect,
		);

		expect(result).toContain('COMMENT ON COLUMN "products"."name"');
		expect(result).toContain("IS 'Product''s name with quotes'");
	});

	test("should handle multiple columns with comments", () => {
		const table: TableIR = buildTable({
			name: "users",
			columns: [
				buildColumn({
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
					comment: "Primary key",
				}),
				buildColumn({
					name: "email",
					type: { kind: "text" },
					nullable: false,
					comment: "User email address",
				}),
				buildColumn({
					name: "name",
					type: { kind: "text" },
					nullable: true,
					comment: "Full name",
				}),
			],
			constraints: [buildPrimaryKey(["id"], "users_pkey")],
			indexes: [],
		});

		const result = emitSchema(
			{ name: "test", tables: [table], enums: [] },
			postgresDialect,
		);

		expect(result).toContain(
			'COMMENT ON COLUMN "users"."id" IS \'Primary key\'',
		);
		expect(result).toContain(
			'COMMENT ON COLUMN "users"."email" IS \'User email address\'',
		);
		expect(result).toContain(
			'COMMENT ON COLUMN "users"."name" IS \'Full name\'',
		);
	});
});
