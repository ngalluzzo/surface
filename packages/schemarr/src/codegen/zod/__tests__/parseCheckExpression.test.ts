import { describe, expect, test } from "bun:test";
import {
	orderRefinements,
	parseCheckExpression,
	refinementToZod,
} from "../parseCheckExpression";

describe("parseCheckExpression", () => {
	describe("range operators", () => {
		test("price >= 0", () => {
			const result = parseCheckExpression("price >= 0", "price");
			expect(result).toEqual({ kind: "min", value: 0 });
		});

		test("price <= 100", () => {
			const result = parseCheckExpression("price <= 100", "price");
			expect(result).toEqual({ kind: "max", value: 100 });
		});

		test("price > 0", () => {
			const result = parseCheckExpression("price > 0", "price");
			expect(result).toEqual({ kind: "gt", value: 0 });
		});

		test("price < 100", () => {
			const result = parseCheckExpression("price < 100", "price");
			expect(result).toEqual({ kind: "lt", value: 100 });
		});
	});

	describe("negative numbers", () => {
		test("price >= -50", () => {
			const result = parseCheckExpression("price >= -50", "price");
			expect(result).toEqual({ kind: "min", value: -50 });
		});

		test("quantity < -10", () => {
			const result = parseCheckExpression("quantity < -10", "quantity");
			expect(result).toEqual({ kind: "lt", value: -10 });
		});
	});

	describe("decimal numbers", () => {
		test("rating >= 4.5", () => {
			const result = parseCheckExpression("rating >= 4.5", "rating");
			expect(result).toEqual({ kind: "min", value: 4.5 });
		});

		test("temperature < 98.6", () => {
			const result = parseCheckExpression("temperature < 98.6", "temperature");
			expect(result).toEqual({ kind: "lt", value: 98.6 });
		});
	});

	describe("whitespace variations", () => {
		test("age > 18", () => {
			const result = parseCheckExpression("age > 18", "age");
			expect(result).toEqual({ kind: "gt", value: 18 });
		});

		test("count  <=  5", () => {
			const result = parseCheckExpression("count  <=  5", "count");
			expect(result).toEqual({ kind: "max", value: 5 });
		});

		test("  score>=90  ", () => {
			const result = parseCheckExpression("  score>=90  ", "score");
			expect(result).toEqual({ kind: "min", value: 90 });
		});
	});

	describe("pattern matching", () => {
		test("sku ~ ^SKU-[0-9]+$", () => {
			const result = parseCheckExpression("sku ~ '^SKU-[0-9]+$'", "sku");
			expect(result).toEqual({ kind: "regex", pattern: "/^SKU-[0-9]+$/" });
		});

		test("email ~ ^[a-z]+@example\\.com$", () => {
			const result = parseCheckExpression(
				"email ~ '^[a-z]+@example\\\\.com$'",
				"email",
			);
			expect(result).toEqual({
				kind: "regex",
				pattern: "/^[a-z]+@example\\.com$/",
			});
		});

		test("code ~ ^[A-Z]{2}-\\d{4}$", () => {
			const result = parseCheckExpression(
				"code ~ '^[A-Z]{2}-\\\\d{4}$'",
				"code",
			);
			expect(result).toEqual({ kind: "regex", pattern: "/^[A-Z]{2}-\\d{4}$/" });
		});

		test("escaped single quotes in pattern", () => {
			const result = parseCheckExpression(
				"code ~ '^[A-Z]{2}''s-[0-9]+$'",
				"code",
			);
			expect(result).toEqual({
				kind: "regex",
				pattern: "/^[A-Z]{2}'s-[0-9]+$/",
			});
		});

		test("string with + operator (unsupported operator for string)", () => {
			const result = parseCheckExpression("sku + '^SKU-[0-9]+$'", "sku");
			expect(result).toEqual({
				kind: "unsupported",
				expression: "sku + '^SKU-[0-9]+$'",
			});
		});
	});
});

describe("unsupported expressions", () => {
	test("quantity > true (invalid type)", () => {
		const result = parseCheckExpression("quantity > true", "quantity");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "quantity > true",
		});
	});

	test("price > cost + tax (compound)", () => {
		const result = parseCheckExpression("price > cost + tax", "price");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "price > cost + tax",
		});
	});

	test("NOW() (function call)", () => {
		const result = parseCheckExpression("NOW()", "created_at");
		expect(result).toEqual({ kind: "unsupported", expression: "NOW()" });
	});

	test("user_name ~ pattern (column mismatch)", () => {
		const result = parseCheckExpression("user_name ~ pattern", "sku");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "user_name ~ pattern",
		});
	});

	test("price BETWEEN 0 AND 100 (between)", () => {
		const result = parseCheckExpression("price BETWEEN 0 AND 100", "price");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "price BETWEEN 0 AND 100",
		});
	});

	test("quantity IN (1, 2, 3) (in clause)", () => {
		const result = parseCheckExpression("quantity IN (1, 2, 3)", "quantity");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "quantity IN (1, 2, 3)",
		});
	});

	test("unknown character @ (unsupported token)", () => {
		const result = parseCheckExpression("price @ 0", "price");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "price @ 0",
		});
	});

	test("quantity + 5 (unsupported operator for number)", () => {
		const result = parseCheckExpression("quantity + 5", "quantity");
		expect(result).toEqual({
			kind: "unsupported",
			expression: "quantity + 5",
		});
	});
});

describe("refinementToZod", () => {
	test("min refinement", () => {
		const result = refinementToZod({ kind: "min", value: 0 });
		expect(result).toBe(".min(0)");
	});

	test("max refinement", () => {
		const result = refinementToZod({ kind: "max", value: 100 });
		expect(result).toBe(".max(100)");
	});

	test("gt refinement", () => {
		const result = refinementToZod({ kind: "gt", value: 0 });
		expect(result).toBe(".gt(0)");
	});

	test("lt refinement", () => {
		const result = refinementToZod({ kind: "lt", value: 100 });
		expect(result).toBe(".lt(100)");
	});

	test("regex refinement", () => {
		const result = refinementToZod({ kind: "regex", pattern: "/^[A-Z]+$/" });
		expect(result).toBe(".regex(/^[A-Z]+$/)");
	});

	test("unsupported refinement returns null", () => {
		const result = refinementToZod({
			kind: "unsupported",
			expression: "price > cost",
		});
		expect(result).toBeNull();
	});
});

describe("orderRefinements", () => {
	test("orders range before pattern", () => {
		const refinements = [
			{ kind: "regex", pattern: "/^SKU-[0-9]+$/" } as const,
			{ kind: "min", value: 0 } as const,
			{ kind: "max", value: 100 } as const,
		];
		const result = orderRefinements(refinements);
		expect(result).toEqual([
			{ kind: "min", value: 0 },
			{ kind: "max", value: 100 },
			{ kind: "regex", pattern: "/^SKU-[0-9]+$/" },
		]);
	});

	test("preserves unsupported refinements", () => {
		const refinements = [
			{ kind: "unsupported", expression: "NOW()" } as const,
			{ kind: "min", value: 0 } as const,
		];
		const result = orderRefinements(refinements);
		expect(result).toEqual([
			{ kind: "min", value: 0 },
			{ kind: "unsupported", expression: "NOW()" },
		]);
	});

	test("handles empty array", () => {
		const result = orderRefinements([]);
		expect(result).toEqual([]);
	});
});
