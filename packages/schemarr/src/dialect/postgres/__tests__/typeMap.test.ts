import { describe, expect, test } from "bun:test";
import { mapType } from "../typeMap";

describe("mapType", () => {
	describe("primitive types", () => {
		test("text maps to TEXT", () => {
			const result = mapType({ kind: "text" });
			expect(result).toBe("TEXT");
		});

		test("uuid maps to UUID", () => {
			const result = mapType({ kind: "uuid" });
			expect(result).toBe("UUID");
		});

		test("integer maps to INTEGER", () => {
			const result = mapType({ kind: "integer" });
			expect(result).toBe("INTEGER");
		});

		test("bigint maps to BIGINT", () => {
			const result = mapType({ kind: "bigint" });
			expect(result).toBe("BIGINT");
		});

		test("double_precision maps to DOUBLE PRECISION", () => {
			const result = mapType({ kind: "double_precision" });
			expect(result).toBe("DOUBLE PRECISION");
		});

		test("boolean maps to BOOLEAN", () => {
			const result = mapType({ kind: "boolean" });
			expect(result).toBe("BOOLEAN");
		});

		test("date maps to DATE", () => {
			const result = mapType({ kind: "date" });
			expect(result).toBe("DATE");
		});

		test("timestamp maps to TIMESTAMP", () => {
			const result = mapType({ kind: "timestamp" });
			expect(result).toBe("TIMESTAMP");
		});

		test("timestamptz maps to TIMESTAMPTZ", () => {
			const result = mapType({ kind: "timestamptz" });
			expect(result).toBe("TIMESTAMPTZ");
		});

		test("json maps to JSON", () => {
			const result = mapType({ kind: "json" });
			expect(result).toBe("JSON");
		});

		test("jsonb maps to JSONB", () => {
			const result = mapType({ kind: "jsonb" });
			expect(result).toBe("JSONB");
		});

		test("serial maps to SERIAL", () => {
			const result = mapType({ kind: "serial" });
			expect(result).toBe("SERIAL");
		});

		test("bigserial maps to BIGSERIAL", () => {
			const result = mapType({ kind: "bigserial" });
			expect(result).toBe("BIGSERIAL");
		});
	});

	describe("varchar", () => {
		test("varchar with maxLength maps to VARCHAR(N)", () => {
			const result = mapType({ kind: "varchar", maxLength: 255 });
			expect(result).toBe("VARCHAR(255)");
		});

		test("varchar with different maxLength", () => {
			const result = mapType({ kind: "varchar", maxLength: 100 });
			expect(result).toBe("VARCHAR(100)");
		});

		test("varchar with zero maxLength", () => {
			const result = mapType({ kind: "varchar", maxLength: 0 });
			expect(result).toBe("VARCHAR(0)");
		});
	});

	describe("array types", () => {
		test("array of text maps to TEXT[]", () => {
			const result = mapType({ kind: "array", inner: { kind: "text" } });
			expect(result).toBe("TEXT[]");
		});

		test("array of integer maps to INTEGER[]", () => {
			const result = mapType({ kind: "array", inner: { kind: "integer" } });
			expect(result).toBe("INTEGER[]");
		});

		test("array of uuid maps to UUID[]", () => {
			const result = mapType({ kind: "array", inner: { kind: "uuid" } });
			expect(result).toBe("UUID[]");
		});

		test("nested array of text maps to TEXT[][]", () => {
			const result = mapType({
				kind: "array",
				inner: { kind: "array", inner: { kind: "text" } },
			});
			expect(result).toBe("TEXT[][]");
		});

		test("array of varchar maps to VARCHAR(N)[]", () => {
			const result = mapType({
				kind: "array",
				inner: { kind: "varchar", maxLength: 100 },
			});
			expect(result).toBe("VARCHAR(100)[]");
		});

		test("array of enum maps to enumName[]", () => {
			const result = mapType({
				kind: "array",
				inner: { kind: "enum", enumName: "status_type" },
			});
			expect(result).toBe("status_type[]");
		});
	});

	describe("enum types", () => {
		test("enum type returns enum name", () => {
			const result = mapType({ kind: "enum", enumName: "user_status" });
			expect(result).toBe("user_status");
		});

		test("enum with underscore in name", () => {
			const result = mapType({ kind: "enum", enumName: "order_status" });
			expect(result).toBe("order_status");
		});
	});

	describe("edge cases", () => {
		test("array of jsonb maps to JSONB[]", () => {
			const result = mapType({ kind: "array", inner: { kind: "jsonb" } });
			expect(result).toBe("JSONB[]");
		});

		test("array of timestamptz maps to TIMESTAMPTZ[]", () => {
			const result = mapType({ kind: "array", inner: { kind: "timestamptz" } });
			expect(result).toBe("TIMESTAMPTZ[]");
		});

		test("array of boolean maps to BOOLEAN[]", () => {
			const result = mapType({ kind: "array", inner: { kind: "boolean" } });
			expect(result).toBe("BOOLEAN[]");
		});
	});
});
