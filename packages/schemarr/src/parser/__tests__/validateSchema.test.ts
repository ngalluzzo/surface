import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { expectErrKind, expectOk } from "../../lib/test/helpers/assertions";
import {
	allFixtureNames,
	loadSchemaFixture,
} from "../../lib/test/helpers/load-fixtures";
import { validateSchema } from "../validateSchema";

/** Type guard for JSONSchema7 */
function isJSONSchema7(value: unknown): value is JSONSchema7 {
	return (
		typeof value === "object" &&
		value !== null &&
		("type" in value || "$schema" in value)
	);
}

describe("validateSchema", () => {
	describe("happy paths (fixtures)", () => {
		for (const name of allFixtureNames) {
			test(`${name}.json validates as Ok`, () => {
				const schema = loadSchemaFixture(name);
				const result = validateSchema(schema);
				expectOk(result);
			});
		}

		test("circular-ref.json validates as Ok", () => {
			const schema = loadSchemaFixture("circular-ref");
			const result = validateSchema(schema);
			expectOk(result);
		});

		test("returns correct title and schema from minimal.json", () => {
			const schema = loadSchemaFixture("minimal");
			if (!isJSONSchema7(schema)) {
				throw new Error("Schema is not a valid JSONSchema7");
			}
			const result = expectOk(validateSchema(schema));
			expect(result.title).toBe("User");
			expect(result.schema).toBe(schema);
		});

		test("returns correct title from ecommerce-order.json", () => {
			const schema = loadSchemaFixture("ecommerce-order");
			const result = expectOk(validateSchema(schema));
			expect(result.title).toBe("Order");
		});
	});

	describe("error: invalid_json (not an object)", () => {
		test("null", () => {
			expectErrKind(validateSchema(null), "invalid_json");
		});

		test("string", () => {
			expectErrKind(validateSchema("hello"), "invalid_json");
		});

		test("number", () => {
			expectErrKind(validateSchema(42), "invalid_json");
		});

		test("array", () => {
			expectErrKind(validateSchema([1, 2, 3]), "invalid_json");
		});

		test("undefined", () => {
			expectErrKind(validateSchema(undefined), "invalid_json");
		});

		test("boolean", () => {
			expectErrKind(validateSchema(true), "invalid_json");
		});
	});

	describe("error: missing_type", () => {
		test("empty object", () => {
			expectErrKind(validateSchema({}), "missing_type");
		});

		test("object with title but no type", () => {
			expectErrKind(validateSchema({ title: "Foo" }), "missing_type");
		});
	});

	describe("error: invalid_schema", () => {
		test('type is "string" (not object)', () => {
			expectErrKind(
				validateSchema({ type: "string", title: "Foo" }),
				"invalid_schema",
			);
		});

		test('type is "array" (not object)', () => {
			expectErrKind(
				validateSchema({ type: "array", title: "Foo" }),
				"invalid_schema",
			);
		});

		test("no title", () => {
			expectErrKind(validateSchema({ type: "object" }), "invalid_schema");
		});

		test("empty title", () => {
			expectErrKind(
				validateSchema({ type: "object", title: "" }),
				"invalid_schema",
			);
		});

		test("non-string title", () => {
			expectErrKind(
				validateSchema({ type: "object", title: 123 }),
				"invalid_schema",
			);
		});
	});

	describe("edge cases (still Ok)", () => {
		test("schema without $schema field", () => {
			const result = validateSchema({ type: "object", title: "Foo" });
			expectOk(result);
		});

		test("schema without required", () => {
			const result = validateSchema({
				type: "object",
				title: "Foo",
				properties: {},
			});
			expectOk(result);
		});

		test("schema without properties", () => {
			const result = validateSchema({ type: "object", title: "Foo" });
			expectOk(result);
		});
	});
});
