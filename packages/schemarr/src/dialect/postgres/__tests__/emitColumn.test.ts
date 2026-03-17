import { describe, expect, test } from "bun:test";
import { buildColumn } from "../../../lib/test/helpers/builders";
import type { ColumnIR } from "../../../lib/types";
import { emitColumn } from "../emitColumn";

describe("emitColumn", () => {
	describe("simple columns", () => {
		test("simple text column", () => {
			const col: ColumnIR = buildColumn({
				name: "name",
				type: { kind: "text" },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"name" TEXT');
		});

		test("simple integer column", () => {
			const col: ColumnIR = buildColumn({
				name: "count",
				type: { kind: "integer" },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"count" INTEGER NOT NULL');
		});

		test("uuid column", () => {
			const col: ColumnIR = buildColumn({
				name: "id",
				type: { kind: "uuid" },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"id" UUID NOT NULL');
		});

		test("boolean column", () => {
			const col: ColumnIR = buildColumn({
				name: "active",
				type: { kind: "boolean" },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"active" BOOLEAN');
		});

		test("date column", () => {
			const col: ColumnIR = buildColumn({
				name: "created_at",
				type: { kind: "timestamptz" },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"created_at" TIMESTAMPTZ NOT NULL');
		});
	});

	describe("varchar columns", () => {
		test("varchar with length", () => {
			const col: ColumnIR = buildColumn({
				name: "email",
				type: { kind: "varchar", maxLength: 255 },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"email" VARCHAR(255) NOT NULL');
		});

		test("varchar nullable", () => {
			const col: ColumnIR = buildColumn({
				name: "username",
				type: { kind: "varchar", maxLength: 100 },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"username" VARCHAR(100)');
		});
	});

	describe("array columns", () => {
		test("text array column", () => {
			const col: ColumnIR = buildColumn({
				name: "tags",
				type: { kind: "array", inner: { kind: "text" } },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"tags" TEXT[]');
		});

		test("integer array column NOT NULL", () => {
			const col: ColumnIR = buildColumn({
				name: "numbers",
				type: { kind: "array", inner: { kind: "integer" } },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"numbers" INTEGER[] NOT NULL');
		});

		test("uuid array column", () => {
			const col: ColumnIR = buildColumn({
				name: "tag_ids",
				type: { kind: "array", inner: { kind: "uuid" } },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"tag_ids" UUID[]');
		});
	});

	describe("enum columns", () => {
		test("enum column references type", () => {
			const col: ColumnIR = buildColumn({
				name: "status",
				type: { kind: "enum", enumName: "order_status" },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"status" order_status NOT NULL');
		});

		test("enum column nullable", () => {
			const col: ColumnIR = buildColumn({
				name: "priority",
				type: { kind: "enum", enumName: "ticket_priority" },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"priority" ticket_priority');
		});
	});

	describe("jsonb columns", () => {
		test("jsonb column", () => {
			const col: ColumnIR = buildColumn({
				name: "metadata",
				type: { kind: "jsonb" },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"metadata" JSONB');
		});

		test("jsonb column NOT NULL", () => {
			const col: ColumnIR = buildColumn({
				name: "config",
				type: { kind: "jsonb" },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"config" JSONB NOT NULL');
		});
	});

	describe("default values - literal", () => {
		test("string default", () => {
			const col: ColumnIR = buildColumn({
				name: "role",
				type: { kind: "text" },
				nullable: false,
				default: { kind: "literal", value: "user" },
			});

			const result = emitColumn(col);
			expect(result).toBe("\"role\" TEXT NOT NULL DEFAULT 'user'");
		});

		test("number default", () => {
			const col: ColumnIR = buildColumn({
				name: "count",
				type: { kind: "integer" },
				nullable: false,
				default: { kind: "literal", value: 0 },
			});

			const result = emitColumn(col);
			expect(result).toBe('"count" INTEGER NOT NULL DEFAULT 0');
		});

		test("boolean default", () => {
			const col: ColumnIR = buildColumn({
				name: "active",
				type: { kind: "boolean" },
				nullable: false,
				default: { kind: "literal", value: false },
			});

			const result = emitColumn(col);
			expect(result).toBe('"active" BOOLEAN NOT NULL DEFAULT false');
		});

		test("negative number default", () => {
			const col: ColumnIR = buildColumn({
				name: "offset",
				type: { kind: "integer" },
				nullable: false,
				default: { kind: "literal", value: -5 },
			});

			const result = emitColumn(col);
			expect(result).toBe('"offset" INTEGER NOT NULL DEFAULT -5');
		});
	});

	describe("default values - expression", () => {
		test("now() default", () => {
			const col: ColumnIR = buildColumn({
				name: "created_at",
				type: { kind: "timestamptz" },
				nullable: false,
				default: { kind: "expression", expression: "now()" },
			});

			const result = emitColumn(col);
			expect(result).toBe('"created_at" TIMESTAMPTZ NOT NULL DEFAULT now()');
		});

		test("gen_random_uuid() default", () => {
			const col: ColumnIR = buildColumn({
				name: "id",
				type: { kind: "uuid" },
				nullable: false,
				default: { kind: "expression", expression: "gen_random_uuid()" },
			});

			const result = emitColumn(col);
			expect(result).toBe('"id" UUID NOT NULL DEFAULT gen_random_uuid()');
		});
	});

	describe("comments", () => {
		test("column with comment - comments emitted separately", () => {
			const col: ColumnIR = buildColumn({
				name: "email",
				type: { kind: "text" },
				nullable: false,
				comment: "User email address",
			});

			const result = emitColumn(col);
			// Comments are NOT emitted inline in PostgreSQL
			expect(result).toBe('"email" TEXT NOT NULL');
		});

		test("column with comment containing quotes - comments emitted separately", () => {
			const col: ColumnIR = buildColumn({
				name: "name",
				type: { kind: "text" },
				nullable: true,
				comment: "User's name",
			});

			const result = emitColumn(col);
			expect(result).toBe('"name" TEXT');
		});

		test("column with comment and default - comments emitted separately", () => {
			const col: ColumnIR = buildColumn({
				name: "status",
				type: { kind: "text" },
				nullable: false,
				default: { kind: "literal", value: "active" },
				comment: "Current status",
			});

			const result = emitColumn(col);
			expect(result).toBe("\"status\" TEXT NOT NULL DEFAULT 'active'");
		});
	});

	describe("combined features", () => {
		test("nullable varchar with default", () => {
			const col: ColumnIR = buildColumn({
				name: "username",
				type: { kind: "varchar", maxLength: 100 },
				nullable: true,
				default: { kind: "literal", value: "anonymous" },
			});

			const result = emitColumn(col);
			expect(result).toBe("\"username\" VARCHAR(100) DEFAULT 'anonymous'");
		});

		test("not null enum with comment - comment emitted separately", () => {
			const col: ColumnIR = buildColumn({
				name: "status",
				type: { kind: "enum", enumName: "post_status" },
				nullable: false,
				comment: "Post status",
			});

			const result = emitColumn(col);
			// Comments are NOT emitted inline in PostgreSQL
			expect(result).toBe('"status" post_status NOT NULL');
		});

		test("array with default and comment - comment emitted separately", () => {
			const col: ColumnIR = buildColumn({
				name: "tags",
				type: { kind: "array", inner: { kind: "text" } },
				nullable: false,
				default: { kind: "expression", expression: "ARRAY[]::TEXT[]" },
				comment: "Tags",
			});

			const result = emitColumn(col);
			expect(result).toBe('"tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]');
		});

		test("complex column: not null, default, comment - comment emitted separately", () => {
			const col: ColumnIR = buildColumn({
				name: "created_at",
				type: { kind: "timestamptz" },
				nullable: false,
				default: { kind: "expression", expression: "now()" },
				comment: "Creation timestamp",
			});

			const result = emitColumn(col);
			expect(result).toBe('"created_at" TIMESTAMPTZ NOT NULL DEFAULT now()');
		});
	});

	describe("special characters in names", () => {
		test("column name with underscores", () => {
			const col: ColumnIR = buildColumn({
				name: "user_id",
				type: { kind: "uuid" },
				nullable: false,
			});

			const result = emitColumn(col);
			expect(result).toBe('"user_id" UUID NOT NULL');
		});

		test("column name with camelCase", () => {
			const col: ColumnIR = buildColumn({
				name: "firstName",
				type: { kind: "text" },
				nullable: true,
			});

			const result = emitColumn(col);
			expect(result).toBe('"firstName" TEXT');
		});
	});
});
