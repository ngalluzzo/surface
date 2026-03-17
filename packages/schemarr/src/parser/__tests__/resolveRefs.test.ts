import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import type { ParseError, RefError } from "../../lib/errors";
import { expectErrKind, expectOk } from "../../lib/test/helpers/assertions";
import { loadSchemaFixture } from "../../lib/test/helpers/load-fixtures";
import { parseSchema } from "../parseSchema";
import { resolveRefs } from "../resolveRefs";
import type { RawObjectDef, RawSchemaIR, ResolvedSchemaIR } from "../types";
import { validateSchema } from "../validateSchema";

/** Type guard for unresolved_ref error */
function isUnresolvedRef(
	error: ParseError | RefError,
): error is Extract<RefError, { kind: "unresolved_ref" }> {
	return error.kind === "unresolved_ref";
}

/** Helper: validate → parse → resolve a fixture */
const resolveFixture = (name: string) => {
	const raw = loadSchemaFixture(name);
	const validated = expectOk(validateSchema(raw));
	const parsed = expectOk(parseSchema(validated));
	return resolveRefs(parsed);
};

/** Helper: find a resolved property by name on the root */
const findRootProp = (resolved: ResolvedSchemaIR, propName: string) => {
	const prop = resolved.root.properties.find((p) => p.name === propName);
	if (!prop) throw new Error(`Property "${propName}" not found on root`);
	return prop;
};

/** Helper: find a resolved property by name on a definition */
const findDefProp = (
	resolved: ResolvedSchemaIR,
	defName: string,
	propName: string,
) => {
	const def = resolved.definitions.get(defName);
	if (!def) throw new Error(`Definition "${defName}" not found`);
	const prop = def.properties.find((p) => p.name === propName);
	if (!prop)
		throw new Error(`Property "${propName}" not found on "${defName}"`);
	return prop;
};

/** Helper: build a minimal RawSchemaIR for hand-crafted tests */
const buildRaw = (
	rootProps: Record<string, JSONSchema7>,
	rootRequired: string[] = [],
	definitions: Record<
		string,
		{ schema: JSONSchema7; required?: string[] }
	> = {},
): RawSchemaIR => {
	const root: RawObjectDef = {
		name: "TestRoot",
		schema: {
			type: "object",
			properties: rootProps,
			required: rootRequired,
		} as JSONSchema7,
		isRoot: true,
	};

	const defMap = new Map<string, RawObjectDef>();
	for (const [name, { schema, required }] of Object.entries(definitions)) {
		defMap.set(name, {
			name,
			schema: { ...schema, required } as JSONSchema7,
			isRoot: false,
		});
	}

	return { root, definitions: defMap };
};

describe("resolveRefs", () => {
	describe("no refs", () => {
		test("minimal.json: all properties resolved without refTarget", () => {
			const result = expectOk(resolveFixture("minimal"));
			expect(result.root.properties).toHaveLength(3);
			for (const prop of result.root.properties) {
				expect(prop.refTarget).toBeUndefined();
			}
		});

		test("all-types.json: no property has refTarget", () => {
			const result = expectOk(resolveFixture("all-types"));
			for (const prop of result.root.properties) {
				expect(prop.refTarget).toBeUndefined();
			}
		});

		test("with-enums.json: no property has refTarget", () => {
			const result = expectOk(resolveFixture("with-enums"));
			for (const prop of result.root.properties) {
				expect(prop.refTarget).toBeUndefined();
			}
		});

		test("with-constraints.json: no property has refTarget", () => {
			const result = expectOk(resolveFixture("with-constraints"));
			for (const prop of result.root.properties) {
				expect(prop.refTarget).toBeUndefined();
			}
		});
	});

	describe("simple $ref", () => {
		test('with-refs.json: author has refTarget "Author"', () => {
			const result = expectOk(resolveFixture("with-refs"));
			const author = findRootProp(result, "author");
			expect(author.refTarget).toBe("Author");
		});

		test('with-refs.json: reviewer has refTarget "Author"', () => {
			const result = expectOk(resolveFixture("with-refs"));
			const reviewer = findRootProp(result, "reviewer");
			expect(reviewer.refTarget).toBe("Author");
		});

		test("with-refs.json: author is required, reviewer is not", () => {
			const result = expectOk(resolveFixture("with-refs"));
			const author = findRootProp(result, "author");
			const reviewer = findRootProp(result, "reviewer");
			expect(author.required).toBe(true);
			expect(reviewer.required).toBe(false);
		});

		test("with-refs.json: non-ref properties have no refTarget", () => {
			const result = expectOk(resolveFixture("with-refs"));
			const title = findRootProp(result, "title");
			const body = findRootProp(result, "body");
			expect(title.refTarget).toBeUndefined();
			expect(body.refTarget).toBeUndefined();
		});
	});

	describe("nested objects", () => {
		test('nested-objects.json: headquarters has refTarget "Office"', () => {
			const result = expectOk(resolveFixture("nested-objects"));
			const hq = findRootProp(result, "headquarters");
			expect(hq.refTarget).toBe("Office");
		});

		test("nested-objects.json: address has no refTarget (inline object)", () => {
			const result = expectOk(resolveFixture("nested-objects"));
			const address = findRootProp(result, "address");
			expect(address.refTarget).toBeUndefined();
		});

		test("nested-objects.json: settings has no refTarget (unstructured object)", () => {
			const result = expectOk(resolveFixture("nested-objects"));
			const settings = findRootProp(result, "settings");
			expect(settings.refTarget).toBeUndefined();
		});
	});

	describe("array $ref", () => {
		test('array-relations.json: lessons has refTarget "Lesson"', () => {
			const result = expectOk(resolveFixture("array-relations"));
			const lessons = findRootProp(result, "lessons");
			expect(lessons.refTarget).toBe("Lesson");
		});

		test('array-relations.json: students has refTarget "Student"', () => {
			const result = expectOk(resolveFixture("array-relations"));
			const students = findRootProp(result, "students");
			expect(students.refTarget).toBe("Student");
		});

		test("array-relations.json: tags has no refTarget (primitive array)", () => {
			const result = expectOk(resolveFixture("array-relations"));
			const tags = findRootProp(result, "tags");
			expect(tags.refTarget).toBeUndefined();
		});
	});

	describe("complex", () => {
		test('ecommerce-order.json: customer has refTarget "Customer"', () => {
			const result = expectOk(resolveFixture("ecommerce-order"));
			const customer = findRootProp(result, "customer");
			expect(customer.refTarget).toBe("Customer");
		});

		test('ecommerce-order.json: line_items has refTarget "LineItem"', () => {
			const result = expectOk(resolveFixture("ecommerce-order"));
			const lineItems = findRootProp(result, "line_items");
			expect(lineItems.refTarget).toBe("LineItem");
		});

		test("ecommerce-order.json: shipping_address has no refTarget", () => {
			const result = expectOk(resolveFixture("ecommerce-order"));
			const shipping = findRootProp(result, "shipping_address");
			expect(shipping.refTarget).toBeUndefined();
		});

		test("ecommerce-order.json: required fields are marked correctly", () => {
			const result = expectOk(resolveFixture("ecommerce-order"));
			expect(findRootProp(result, "id").required).toBe(true);
			expect(findRootProp(result, "customer").required).toBe(true);
			expect(findRootProp(result, "status").required).toBe(true);
			expect(findRootProp(result, "line_items").required).toBe(true);
			expect(findRootProp(result, "notes").required).toBe(false);
			expect(findRootProp(result, "shipping_address").required).toBe(false);
		});
	});

	describe("circular refs", () => {
		test("circular-ref.json: resolves successfully (not an error)", () => {
			const result = resolveFixture("circular-ref");
			expectOk(result);
		});

		test('circular-ref.json: root sibling has refTarget "NodeB"', () => {
			const result = expectOk(resolveFixture("circular-ref"));
			const sibling = findRootProp(result, "sibling");
			expect(sibling.refTarget).toBe("NodeB");
		});

		test('circular-ref.json: NodeB back_ref has refTarget "NodeA"', () => {
			const result = expectOk(resolveFixture("circular-ref"));
			const backRef = findDefProp(result, "NodeB", "back_ref");
			expect(backRef.refTarget).toBe("NodeA");
		});

		test('circular-ref.json: NodeA definition sibling has refTarget "NodeB"', () => {
			const result = expectOk(resolveFixture("circular-ref"));
			const sibling = findDefProp(result, "NodeA", "sibling");
			expect(sibling.refTarget).toBe("NodeB");
		});
	});

	describe("property resolution", () => {
		test("each property has name, schema, and required", () => {
			const result = expectOk(resolveFixture("minimal"));
			for (const prop of result.root.properties) {
				expect(typeof prop.name).toBe("string");
				expect(prop.schema).toBeDefined();
				expect(typeof prop.required).toBe("boolean");
			}
		});

		test("property schema is the property-level schema, not the definition", () => {
			const result = expectOk(resolveFixture("with-refs"));
			const author = findRootProp(result, "author");
			// The property schema should be the $ref schema, not the Author definition
			expect(author.schema).toHaveProperty("$ref");
		});

		test("definitions are also resolved", () => {
			const result = expectOk(resolveFixture("with-refs"));
			const author = result.definitions.get("Author");
			if (!author) throw new Error("Expected Author definition");
			expect(author).toBeDefined();
			expect(author.properties.length).toBeGreaterThan(0);
			expect(author.isRoot).toBe(false);
		});
	});

	describe("error cases", () => {
		test("unresolved $ref returns error", () => {
			const raw = buildRaw({
				broken: { $ref: "#/definitions/NonExistent" } as JSONSchema7,
			});
			const result = resolveRefs(raw);
			expectErrKind(result, "unresolved_ref");
		});

		test("unresolved ref error includes the ref string", () => {
			const raw = buildRaw({
				broken: { $ref: "#/definitions/Missing" } as JSONSchema7,
			});
			const error = expectErrKind(resolveRefs(raw), "unresolved_ref");
			if (!isUnresolvedRef(error)) {
				throw new Error("Expected unresolved_ref error");
			}
			expect(error.ref).toBe("#/definitions/Missing");
		});

		test("unresolved $ref in array items returns error", () => {
			const raw = buildRaw({
				items: {
					type: "array",
					items: { $ref: "#/definitions/Ghost" },
				} as JSONSchema7,
			});
			const result = resolveRefs(raw);
			expectErrKind(result, "unresolved_ref");
		});
	});
});
