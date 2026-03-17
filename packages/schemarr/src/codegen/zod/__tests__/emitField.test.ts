import { describe, expect, test } from "bun:test";
import { buildColumn } from "../../../lib/test/helpers/builders";
import type { ColumnIR, ConstraintIR } from "../../../lib/types";
import { type EmitFieldContext, emitField } from "../emitField";

const defaultCtx: EmitFieldContext = { checks: [] };

describe("emitField", () => {
	describe("simple columns", () => {
		test("uuid column with nullable: false", () => {
			const col: ColumnIR = buildColumn({
				name: "id",
				type: { kind: "uuid" },
				nullable: false,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.uuid()");
		});

		test("text column with nullable: true", () => {
			const col: ColumnIR = buildColumn({
				name: "email",
				type: { kind: "text" },
				nullable: true,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.string().nullable().optional()");
		});
	});

	describe("columns with check constraints", () => {
		test("double_precision with CHECK price >= 0", () => {
			const col: ColumnIR = buildColumn({
				name: "price",
				type: { kind: "double_precision" },
				nullable: false,
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{ kind: "check", name: "price_nonnegative", expression: "price >= 0" },
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe("z.number().min(0)");
		});

		test("double_precision with CHECK price >= 0 AND price <= 100 (compound, unsupported)", () => {
			const col: ColumnIR = buildColumn({
				name: "price",
				type: { kind: "double_precision" },
				nullable: false,
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{
					kind: "check",
					name: "price_range",
					expression: "price >= 0 AND price <= 100",
				},
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe("z.number()");
		});

		test("integer with multiple checks: quantity > 0 and quantity <= 999999", () => {
			const col: ColumnIR = buildColumn({
				name: "quantity",
				type: { kind: "integer" },
				nullable: false,
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{
					kind: "check",
					name: "quantity_positive",
					expression: "quantity > 0",
				},
				{
					kind: "check",
					name: "quantity_max",
					expression: "quantity <= 999999",
				},
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe("z.number().int().gt(0).max(999999)");
		});
	});

	describe("columns with default values - literal", () => {
		test("integer with default literal(0)", () => {
			const col: ColumnIR = buildColumn({
				name: "count",
				type: { kind: "integer" },
				nullable: false,
				default: { kind: "literal", value: 0 },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.number().int().default(0)");
		});

		test("boolean with default literal(true)", () => {
			const col: ColumnIR = buildColumn({
				name: "active",
				type: { kind: "boolean" },
				nullable: false,
				default: { kind: "literal", value: true },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.boolean().default(true)");
		});

		test('text with default literal("user")', () => {
			const col: ColumnIR = buildColumn({
				name: "role",
				type: { kind: "text" },
				nullable: false,
				default: { kind: "literal", value: "user" },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe('z.string().default("user")');
		});

		test('text with nullable: true and default literal("user") - no .optional()', () => {
			const col: ColumnIR = buildColumn({
				name: "role",
				type: { kind: "text" },
				nullable: true,
				default: { kind: "literal", value: "user" },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe('z.string().nullable().default("user")');
		});
	});

	describe("columns with default values - expression", () => {
		test("timestamptz with default expression(now()) - skip expression default", () => {
			const col: ColumnIR = buildColumn({
				name: "created_at",
				type: { kind: "timestamptz" },
				nullable: false,
				default: { kind: "expression", expression: "now()" },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.iso.datetime()");
		});
	});

	describe("enum columns", () => {
		test("enum column with nullable: false", () => {
			const col: ColumnIR = buildColumn({
				name: "status",
				type: { kind: "enum", enumName: "order_status" },
				nullable: false,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("orderStatusSchema");
		});
	});

	describe("array columns", () => {
		test("array(text) with nullable: true", () => {
			const col: ColumnIR = buildColumn({
				name: "tags",
				type: { kind: "array", inner: { kind: "text" } },
				nullable: true,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.array(z.string()).nullable().optional()");
		});
	});

	describe("jsonb columns", () => {
		test("jsonb with nullable: true", () => {
			const col: ColumnIR = buildColumn({
				name: "metadata",
				type: { kind: "jsonb" },
				nullable: true,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.unknown().nullable().optional()");
		});
	});

	describe("refinement ordering", () => {
		test("range refinements before pattern refinements", () => {
			const col: ColumnIR = buildColumn({
				name: "sku",
				type: { kind: "text" },
				nullable: false,
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{
					kind: "check",
					name: "sku_pattern",
					expression: "sku ~ '^SKU-[0-9]+$'",
				},
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe("z\n    .string()\n    .regex(/^SKU-[0-9]+$/)");
		});
	});

	describe("combined features", () => {
		test("integer with check and default", () => {
			const col: ColumnIR = buildColumn({
				name: "price",
				type: { kind: "double_precision" },
				nullable: false,
				default: { kind: "literal", value: 9.99 },
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{ kind: "check", name: "price_nonnegative", expression: "price >= 0" },
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe("z.number().min(0).default(9.99)");
		});

		test("integer with multiple checks and default", () => {
			const col: ColumnIR = buildColumn({
				name: "count",
				type: { kind: "integer" },
				nullable: false,
				default: { kind: "literal", value: 1 },
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{ kind: "check", name: "count_positive", expression: "count > 0" },
				{ kind: "check", name: "count_max", expression: "count <= 100" },
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe("z.number().int().gt(0).max(100).default(1)");
		});

		test("varchar with check, nullable, no default", () => {
			const col: ColumnIR = buildColumn({
				name: "email",
				type: { kind: "varchar", maxLength: 255 },
				nullable: true,
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{
					kind: "check",
					name: "email_format",
					expression: "email ~ '^[a-z]+@example\\\\.com$'",
				},
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe(
				"z\n    .string()\n    .max(255)\n    .regex(/^[a-z]+@example\\.com$/)\n    .nullable()\n    .optional()",
			);
		});

		test("integer with check, nullable, with default - no .optional()", () => {
			const col: ColumnIR = buildColumn({
				name: "priority",
				type: { kind: "integer" },
				nullable: true,
				default: { kind: "literal", value: 5 },
			});
			const checks: Extract<ConstraintIR, { kind: "check" }>[] = [
				{ kind: "check", name: "priority_min", expression: "priority >= 1" },
				{ kind: "check", name: "priority_max", expression: "priority <= 10" },
			];
			const ctx: EmitFieldContext = { checks };
			const result = emitField(col, ctx);
			expect(result).toBe(
				"z.number().int().min(1).max(10).nullable().default(5)",
			);
		});
	});

	describe("edge cases", () => {
		test("not nullable without default - no .optional()", () => {
			const col: ColumnIR = buildColumn({
				name: "username",
				type: { kind: "text" },
				nullable: false,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.string()");
		});

		test("nullable without default - has .optional()", () => {
			const col: ColumnIR = buildColumn({
				name: "description",
				type: { kind: "text" },
				nullable: true,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.string().nullable().optional()");
		});

		test("no checks with nullable and default", () => {
			const col: ColumnIR = buildColumn({
				name: "description",
				type: { kind: "text" },
				nullable: true,
				default: { kind: "literal", value: "active" },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe('z.string().nullable().default("active")');
		});

		test("no checks with nullable and default", () => {
			const col: ColumnIR = buildColumn({
				name: "status",
				type: { kind: "text" },
				nullable: true,
				default: { kind: "literal", value: "active" },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe('z.string().nullable().default("active")');
		});
	});

	describe("nullable vs optional in Zod (Issue #4)", () => {
		test("nullable column should produce .nullable() not .optional()", () => {
			const col: ColumnIR = buildColumn({
				name: "bio",
				type: { kind: "text" },
				nullable: true,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toContain(".nullable()");
		});

		test("nullable without default should allow null", () => {
			const col: ColumnIR = buildColumn({
				name: "phone",
				type: { kind: "text" },
				nullable: true,
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe("z.string().nullable().optional()");
		});

		test("nullable with default should allow null but have default", () => {
			const col: ColumnIR = buildColumn({
				name: "status",
				type: { kind: "text" },
				nullable: true,
				default: { kind: "literal", value: "active" },
			});
			const result = emitField(col, defaultCtx);
			expect(result).toBe('z.string().nullable().default("active")');
		});
	});
});
