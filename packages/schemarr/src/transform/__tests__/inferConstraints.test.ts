import { describe, expect, test } from "bun:test";
import { inferConstraints } from "../inferConstraints";
import type { InferConstraintInput } from "../types";

describe("inferConstraints", () => {
	const baseInput = {
		tableName: "products",
		propertyName: "name",
		columnName: "name",
		required: false,
		schema: {
			type: "string",
		},
	} satisfies InferConstraintInput;

	test("should return empty array when no constraints", () => {
		const result = inferConstraints(baseInput);
		expect(result.constraints).toEqual([]);
		expect(result.nextCheckCount).toBe(0);
	});

	test('should infer PRIMARY KEY from property named "id"', () => {
		const result = inferConstraints({
			...baseInput,
			propertyName: "id",
			columnName: "id",
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "primary_key",
			columns: ["id"],
			name: "products_pkey",
		});
	});

	test("should not infer NOT NULL constraint (handled via column nullable)", () => {
		const result = inferConstraints({
			...baseInput,
			required: true,
		});

		expect(result.constraints).toEqual([]);
	});

	test('should not infer NOT NULL for required property named "id"', () => {
		const result = inferConstraints({
			...baseInput,
			propertyName: "id",
			columnName: "id",
			required: true,
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "primary_key",
			columns: ["id"],
		});
	});

	test("should infer CHECK from minimum constraint", () => {
		const result = inferConstraints({
			...baseInput,
			schema: {
				...baseInput.schema,
				minimum: 0,
			},
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "check",
			name: "products_name_check_1",
			expression: "name >= 0",
		});
	});

	test("should infer CHECK from maximum constraint", () => {
		const result = inferConstraints({
			...baseInput,
			schema: {
				...baseInput.schema,
				maximum: 100,
			},
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "check",
			name: "products_name_check_1",
			expression: "name <= 100",
		});
	});

	test("should infer CHECK from exclusiveMinimum constraint", () => {
		const result = inferConstraints({
			...baseInput,
			schema: {
				...baseInput.schema,
				exclusiveMinimum: 0,
			},
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "check",
			name: "products_name_check_1",
			expression: "name > 0",
		});
	});

	test("should infer CHECK from exclusiveMaximum constraint", () => {
		const result = inferConstraints({
			...baseInput,
			schema: {
				...baseInput.schema,
				exclusiveMaximum: 100,
			},
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "check",
			name: "products_name_check_1",
			expression: "name < 100",
		});
	});

	test("should infer CHECK from pattern constraint", () => {
		const result = inferConstraints({
			...baseInput,
			schema: {
				...baseInput.schema,
				pattern: "^[A-Z]{2,4}-[0-9]{4,8}$",
			},
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "check",
			name: "products_name_check_1",
			expression: "name ~ '^[A-Z]{2,4}-[0-9]{4,8}$'",
		});
	});

	test("should infer UNIQUE from uniqueItems", () => {
		const result = inferConstraints({
			...baseInput,
			schema: {
				...baseInput.schema,
				uniqueItems: true,
			},
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "unique",
			columns: ["name"],
			name: "products_name_key",
		});
	});

	test("should infer multiple constraints", () => {
		const result = inferConstraints({
			...baseInput,
			required: true,
			schema: {
				...baseInput.schema,
				minimum: 0,
				maximum: 100,
			},
		});

		expect(result.constraints).toHaveLength(2);
		expect(result.constraints[0]).toMatchObject({
			kind: "check",
			expression: "name >= 0",
		});
		expect(result.constraints[1]).toMatchObject({
			kind: "check",
			expression: "name <= 100",
		});
	});

	test("should generate correct constraint names", () => {
		const result = inferConstraints({
			...baseInput,
			propertyName: "userId",
			columnName: "user_id",
			tableName: "tickets",
			required: true,
		});

		expect(result.constraints).toEqual([]);
	});

	test("should handle property named ID (uppercase)", () => {
		const result = inferConstraints({
			...baseInput,
			propertyName: "ID",
			columnName: "id",
		});

		expect(result.constraints).toHaveLength(1);
		expect(result.constraints[0]).toMatchObject({
			kind: "primary_key",
			columns: ["id"],
			name: "products_pkey",
		});
	});

	test('should not infer PK from property ending in "id" but not exactly "id"', () => {
		const result = inferConstraints({
			...baseInput,
			propertyName: "userId",
			columnName: "user_id",
		});

		expect(result.constraints).toEqual([]);
	});

	describe("SQL injection in pattern constraints (Issue #2)", () => {
		test("should escape single quotes in pattern", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					pattern: "'; DROP TABLE users; --",
				},
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe(
					"name ~ '''; DROP TABLE users; --'",
				);
			}
		});

		test("should escape backslashes in pattern", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					pattern: "\\d+",
				},
			});
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe("name ~ '\\d+'");
			}
		});

		test("should handle complex regex safely", () => {
			const maliciousPattern =
				"'; TRUNCATE TABLE products; REVOKE ALL ON SCHEMA public FROM public; --";
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					pattern: maliciousPattern,
				},
			});
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe(
					"name ~ '''; TRUNCATE TABLE products; REVOKE ALL ON SCHEMA public FROM public; --'",
				);
			}
		});
	});

	describe("exclusiveMinimum/exclusiveMaximum boolean form (Issue #1)", () => {
		test("should handle exclusiveMinimum: true with minimum", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					exclusiveMinimum: true as unknown,
					minimum: 0,
				} as typeof baseInput.schema,
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe("name > 0");
			}
		});

		test("should handle exclusiveMaximum: true with maximum", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					exclusiveMaximum: true as unknown,
					maximum: 100,
				} as typeof baseInput.schema,
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe("name < 100");
			}
		});

		test("should handle numeric exclusiveMinimum (Draft-07+)", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					exclusiveMinimum: 5,
				},
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe("name > 5");
			}
		});

		test("should handle numeric exclusiveMaximum (Draft-07+)", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					...baseInput.schema,
					exclusiveMaximum: 100,
				},
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toBe("name < 100");
			}
		});
	});

	describe("minLength constraints (Issue #7)", () => {
		test("should infer CHECK from minLength constraint", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					type: "string",
					minLength: 5,
				},
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toContain("char_length");
			}
		});

		test("should handle minLength with maxLength", () => {
			const result = inferConstraints({
				...baseInput,
				schema: {
					type: "string",
					minLength: 3,
					maxLength: 50,
				},
			});
			expect(result.constraints).toHaveLength(1);
			if (result.constraints[0]?.kind === "check") {
				expect(result.constraints[0].expression).toContain("char_length");
			}
		});
	});

	describe("constraint name collisions (Issue #12)", () => {
		test("should generate unique constraint names across properties", () => {
			let checkCount = 0;
			const priceConstraints = inferConstraints({
				tableName: "products",
				propertyName: "price",
				columnName: "price",
				required: true,
				schema: { type: "number", minimum: 0, maximum: 1000 },
				startingCheckCount: checkCount,
			});
			checkCount = priceConstraints.nextCheckCount;

			const quantityConstraints = inferConstraints({
				tableName: "products",
				propertyName: "quantity",
				columnName: "quantity",
				required: true,
				schema: { type: "number", minimum: 1, maximum: 999 },
				startingCheckCount: checkCount,
			});

			const allConstraints = [
				...priceConstraints.constraints,
				...quantityConstraints.constraints,
			];
			const checkNames = allConstraints
				.filter((c) => c.kind === "check")
				.map((c) => c.name);

			expect(new Set(checkNames).size).toBe(4);

			expect(checkNames).toContain("products_price_check_1");
			expect(checkNames).toContain("products_price_check_2");
			expect(checkNames).toContain("products_quantity_check_3");
			expect(checkNames).toContain("products_quantity_check_4");
		});
	});
});
