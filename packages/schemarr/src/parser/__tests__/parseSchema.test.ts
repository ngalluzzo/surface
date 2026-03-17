import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { expectOk } from "../../lib/test/helpers/assertions";
import { loadSchemaFixture } from "../../lib/test/helpers/load-fixtures";
import { parseSchema } from "../parseSchema";
import { validateSchema } from "../validateSchema";

/** Helper: validate then parse a fixture */
const parseFixture = (name: string) => {
	const raw = loadSchemaFixture(name);
	const validated = expectOk(validateSchema(raw));
	return parseSchema(validated);
};

/** Type guard for JSONSchema7 */
function isJSONSchema7(value: unknown): value is JSONSchema7 {
	return (
		typeof value === "object" &&
		value !== null &&
		("type" in value || "$schema" in value)
	);
}

/** Type guard for schema fixture with definitions */
function isSchemaFixture(value: unknown): value is {
	definitions?: Record<string, unknown>;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		("definitions" in value || true) // All fixtures can have definitions
	);
}

describe("parseSchema", () => {
	describe("root extraction", () => {
		test('minimal.json: root name is "User"', () => {
			const result = expectOk(parseFixture("minimal"));
			expect(result.root.name).toBe("User");
			expect(result.root.isRoot).toBe(true);
		});

		test('with-refs.json: root name is "Post"', () => {
			const result = expectOk(parseFixture("with-refs"));
			expect(result.root.name).toBe("Post");
			expect(result.root.isRoot).toBe(true);
		});

		test('ecommerce-order.json: root name is "Order"', () => {
			const result = expectOk(parseFixture("ecommerce-order"));
			expect(result.root.name).toBe("Order");
		});

		test("root schema is preserved", () => {
			const raw = loadSchemaFixture("minimal");
			const validated = expectOk(validateSchema(raw));
			const result = expectOk(parseSchema(validated));
			expect(result.root.schema).toBe(validated.schema);
		});
	});

	describe("definitions extraction", () => {
		test("minimal.json: no definitions", () => {
			const result = expectOk(parseFixture("minimal"));
			expect(result.definitions.size).toBe(0);
		});

		test("with-refs.json: has Author definition", () => {
			const result = expectOk(parseFixture("with-refs"));
			expect(result.definitions.has("Author")).toBe(true);
			expect(result.definitions.size).toBe(1);
		});

		test("nested-objects.json: has Office definition", () => {
			const result = expectOk(parseFixture("nested-objects"));
			expect(result.definitions.has("Office")).toBe(true);
			expect(result.definitions.size).toBe(1);
		});

		test("array-relations.json: has Lesson and Student definitions", () => {
			const result = expectOk(parseFixture("array-relations"));
			expect(result.definitions.has("Lesson")).toBe(true);
			expect(result.definitions.has("Student")).toBe(true);
			expect(result.definitions.size).toBe(2);
		});

		test("ecommerce-order.json: has Customer and LineItem definitions", () => {
			const result = expectOk(parseFixture("ecommerce-order"));
			expect(result.definitions.has("Customer")).toBe(true);
			expect(result.definitions.has("LineItem")).toBe(true);
			expect(result.definitions.size).toBe(2);
		});

		test("circular-ref.json: has NodeA and NodeB definitions", () => {
			const result = expectOk(parseFixture("circular-ref"));
			expect(result.definitions.has("NodeA")).toBe(true);
			expect(result.definitions.has("NodeB")).toBe(true);
			expect(result.definitions.size).toBe(2);
		});

		test("with-enums.json: no object definitions", () => {
			const result = expectOk(parseFixture("with-enums"));
			expect(result.definitions.size).toBe(0);
		});

		test("with-constraints.json: no object definitions", () => {
			const result = expectOk(parseFixture("with-constraints"));
			expect(result.definitions.size).toBe(0);
		});
	});

	describe("definition structure", () => {
		test("definitions are not root", () => {
			const result = expectOk(parseFixture("with-refs"));
			const author = result.definitions.get("Author");
			if (!author) throw new Error("Expected Author definition");
			expect(author.isRoot).toBe(false);
		});

		test("definition name matches the key", () => {
			const result = expectOk(parseFixture("with-refs"));
			const author = result.definitions.get("Author");
			if (!author) throw new Error("Expected Author definition");
			expect(author.name).toBe("Author");
		});

		test("definition schema is preserved", () => {
			const raw = loadSchemaFixture("with-refs");
			if (!isSchemaFixture(raw)) {
				throw new Error("Fixture is not a valid schema");
			}
			const defs = raw.definitions ?? {};
			const validated = expectOk(validateSchema(raw));
			const result = expectOk(parseSchema(validated));
			const author = result.definitions.get("Author");
			if (author === undefined) {
				throw new Error("Author definition not found");
			}
			const authorDef = defs.Author;
			if (!isJSONSchema7(authorDef)) {
				throw new Error("Author definition is not a valid JSONSchema7");
			}
			expect(author.schema).toBe(authorDef);
		});
	});
});
