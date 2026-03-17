import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import type { ColumnType } from "../../../lib/types";
import { mapTypeToZod } from "../typeMap";

describe("mapTypeToZod", () => {
	describe("basic types", () => {
		test("text maps to z.string()", () => {
			const type: ColumnType = { kind: "text" };
			expect(mapTypeToZod(type)).toBe("z.string()");
		});

		test("varchar maps to z.string().max(N)", () => {
			const type: ColumnType = { kind: "varchar", maxLength: 255 };
			expect(mapTypeToZod(type)).toBe("z.string().max(255)");
		});

		test("varchar(0) maps to z.string().max(0)", () => {
			const type: ColumnType = { kind: "varchar", maxLength: 0 };
			expect(mapTypeToZod(type)).toBe("z.string().max(0)");
		});

		test("uuid maps to z.uuid()", () => {
			const type: ColumnType = { kind: "uuid" };
			expect(mapTypeToZod(type)).toBe("z.uuid()");
		});

		test("integer maps to z.number().int()", () => {
			const type: ColumnType = { kind: "integer" };
			expect(mapTypeToZod(type)).toBe("z.number().int()");
		});

		test("bigint maps to z.number().int()", () => {
			const type: ColumnType = { kind: "bigint" };
			expect(mapTypeToZod(type)).toBe("z.number().int()");
		});

		test("double_precision maps to z.number()", () => {
			const type: ColumnType = { kind: "double_precision" };
			expect(mapTypeToZod(type)).toBe("z.number()");
		});

		test("boolean maps to z.boolean()", () => {
			const type: ColumnType = { kind: "boolean" };
			expect(mapTypeToZod(type)).toBe("z.boolean()");
		});

		test("date maps to z.iso.date()", () => {
			const type: ColumnType = { kind: "date" };
			expect(mapTypeToZod(type)).toBe("z.iso.date()");
		});

		test("timestamp maps to z.iso.datetime()", () => {
			const type: ColumnType = { kind: "timestamp" };
			expect(mapTypeToZod(type)).toBe("z.iso.datetime()");
		});

		test("timestamptz maps to z.iso.datetime()", () => {
			const type: ColumnType = { kind: "timestamptz" };
			expect(mapTypeToZod(type)).toBe("z.iso.datetime()");
		});
	});

	describe("json/jsonb types", () => {
		test("json without schema maps to z.unknown()", () => {
			const type: ColumnType = { kind: "json" };
			expect(mapTypeToZod(type)).toBe("z.unknown()");
		});

		test("jsonb without schema maps to z.unknown()", () => {
			const type: ColumnType = { kind: "jsonb" };
			expect(mapTypeToZod(type)).toBe("z.unknown()");
		});

		test("jsonb with inline object maps to z.object(...)", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					street: { type: "string" },
					city: { type: "string" },
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe(
				"z.object({ street: z.string(), city: z.string() })",
			);
		});

		test("jsonb with nested object preserves hierarchy", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
					address: {
						type: "object",
						properties: {
							street: { type: "string" },
							city: { type: "string" },
						},
					},
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe(
				"z.object({ name: z.string(), address: z.object({ street: z.string(), city: z.string() }) })",
			);
		});

		test("jsonb with required/optional fields", () => {
			const schema: JSONSchema7 = {
				type: "object",
				required: ["required_field"],
				properties: {
					required_field: { type: "string" },
					optional_field: { type: "string" },
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe(
				"z.object({ required_field: z.string(), optional_field: z.string().optional() })",
			);
		});

		test("jsonb with mixed types", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
					count: { type: "integer" },
					active: { type: "boolean" },
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe(
				"z.object({ name: z.string(), count: z.number().int(), active: z.boolean() })",
			);
		});

		test("jsonb with varchar maps to z.string().max()", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					code: { type: "string", maxLength: 10 },
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe("z.object({ code: z.string().max(10) })");
		});

		test("jsonb with format maps to appropriate zod type", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					created_at: { type: "string", format: "date-time" },
					birth_date: { type: "string", format: "date" },
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe(
				"z.object({ id: z.uuid(), created_at: z.iso.datetime(), birth_date: z.iso.date() })",
			);
		});

		test("jsonb with integer format int64 maps to z.number().int()", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					big_number: { type: "integer", format: "int64" },
				},
			};
			const type: ColumnType = { kind: "jsonb", schema };
			expect(mapTypeToZod(type)).toBe(
				"z.object({ big_number: z.number().int() })",
			);
		});
	});

	describe("array types", () => {
		test("array(text) maps to z.array(z.string())", () => {
			const type: ColumnType = { kind: "array", inner: { kind: "text" } };
			expect(mapTypeToZod(type)).toBe("z.array(z.string())");
		});

		test("array(integer) maps to z.array(z.number().int())", () => {
			const type: ColumnType = { kind: "array", inner: { kind: "integer" } };
			expect(mapTypeToZod(type)).toBe("z.array(z.number().int())");
		});

		test("array(uuid) maps to z.array(z.uuid())", () => {
			const type: ColumnType = { kind: "array", inner: { kind: "uuid" } };
			expect(mapTypeToZod(type)).toBe("z.array(z.uuid())");
		});

		test("array(varchar(100)) maps to z.array(z.string().max(100))", () => {
			const type: ColumnType = {
				kind: "array",
				inner: { kind: "varchar", maxLength: 100 },
			};
			expect(mapTypeToZod(type)).toBe("z.array(z.string().max(100))");
		});

		test("array(array(text)) maps to z.array(z.array(z.string()))", () => {
			const type: ColumnType = {
				kind: "array",
				inner: { kind: "array", inner: { kind: "text" } },
			};
			expect(mapTypeToZod(type)).toBe("z.array(z.array(z.string()))");
		});

		test("array(jsonb) without schema maps to z.array(z.unknown())", () => {
			const type: ColumnType = { kind: "array", inner: { kind: "jsonb" } };
			expect(mapTypeToZod(type)).toBe("z.array(z.unknown())");
		});

		test("array(jsonb) with schema maps to z.array(z.object(...))", () => {
			const schema: JSONSchema7 = {
				type: "object",
				properties: {
					name: { type: "string" },
					value: { type: "number" },
				},
			};
			const type: ColumnType = {
				kind: "array",
				inner: { kind: "jsonb", schema },
			};
			expect(mapTypeToZod(type)).toBe(
				"z.array(z.object({ name: z.string(), value: z.number() }))",
			);
		});
	});

	describe("enum types", () => {
		test("enum(order_status) maps to orderStatusSchema", () => {
			const type: ColumnType = { kind: "enum", enumName: "order_status" };
			expect(mapTypeToZod(type)).toBe("orderStatusSchema");
		});

		test("enum(user_status) maps to userStatusSchema", () => {
			const type: ColumnType = { kind: "enum", enumName: "user_status" };
			expect(mapTypeToZod(type)).toBe("userStatusSchema");
		});
	});

	describe("serial types", () => {
		test("serial maps to z.number().int()", () => {
			const type: ColumnType = { kind: "serial" };
			expect(mapTypeToZod(type)).toBe("z.number().int()");
		});

		test("bigserial maps to z.number().int()", () => {
			const type: ColumnType = { kind: "bigserial" };
			expect(mapTypeToZod(type)).toBe("z.number().int()");
		});
	});
});
