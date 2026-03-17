import { expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import { inferType } from "../inferTypes";

test("string type without format maps to TEXT", () => {
	const schema: JSONSchema7 = { type: "string" };
	const result = inferType("myField", schema);
	expect(result.columnType).toEqual({ kind: "text" });
	expect(result.isEnum).toBe(false);
});

test("string with format uuid maps to UUID", () => {
	const schema: JSONSchema7 = { type: "string", format: "uuid" };
	const result = inferType("myField", schema);
	expect(result.columnType).toEqual({ kind: "uuid" });
	expect(result.isEnum).toBe(false);
});

test("string with format date-time maps to TIMESTAMPTZ", () => {
	const schema: JSONSchema7 = { type: "string", format: "date-time" };
	const result = inferType("myField", schema);
	expect(result.columnType).toEqual({ kind: "timestamptz" });
	expect(result.isEnum).toBe(false);
});

test("string with format date maps to DATE", () => {
	const schema: JSONSchema7 = { type: "string", format: "date" };
	const result = inferType("myField", schema);
	expect(result.columnType).toEqual({ kind: "date" });
	expect(result.isEnum).toBe(false);
});

test("string with format email maps to TEXT", () => {
	const schema: JSONSchema7 = { type: "string", format: "email" };
	const result = inferType("myField", schema);
	expect(result.columnType).toEqual({ kind: "text" });
	expect(result.isEnum).toBe(false);
});

test("string with format uri maps to TEXT", () => {
	const schema: JSONSchema7 = { type: "string", format: "uri" };
	const result = inferType("myField", schema);
	expect(result.columnType).toEqual({ kind: "text" });
	expect(result.isEnum).toBe(false);
});

test("string with enum maps to enum type", () => {
	const schema: JSONSchema7 = {
		type: "string",
		enum: ["active", "inactive", "pending"],
	};
	const result = inferType("status", schema);
	expect(result.columnType).toEqual({
		kind: "enum",
		enumName: "status",
	});
	expect(result.isEnum).toBe(true);
});

test("string with maxLength maps to VARCHAR", () => {
	const schema: JSONSchema7 = { type: "string", maxLength: 255 };
	const result = inferType("email", schema);
	expect(result.columnType).toEqual({ kind: "varchar", maxLength: 255 });
	expect(result.isEnum).toBe(false);
});

test("integer type maps to INTEGER", () => {
	const schema: JSONSchema7 = { type: "integer" };
	const result = inferType("age", schema);
	expect(result.columnType).toEqual({ kind: "integer" });
	expect(result.isEnum).toBe(false);
});

test("integer with format int64 maps to BIGINT", () => {
	const schema: JSONSchema7 = { type: "integer", format: "int64" };
	const result = inferType("bigNumber", schema);
	expect(result.columnType).toEqual({ kind: "bigint" });
	expect(result.isEnum).toBe(false);
});

test("number type maps to DOUBLE PRECISION", () => {
	const schema: JSONSchema7 = { type: "number" };
	const result = inferType("score", schema);
	expect(result.columnType).toEqual({ kind: "double_precision" });
	expect(result.isEnum).toBe(false);
});

test("boolean type maps to BOOLEAN", () => {
	const schema: JSONSchema7 = { type: "boolean" };
	const result = inferType("isActive", schema);
	expect(result.columnType).toEqual({ kind: "boolean" });
	expect(result.isEnum).toBe(false);
});

test("object type maps to JSONB", () => {
	const schema: JSONSchema7 = { type: "object" };
	const result = inferType("metadata", schema);
	expect(result.columnType).toEqual({ kind: "jsonb" });
	expect(result.isEnum).toBe(false);
});

test("inline object with properties preserves JSON Schema", () => {
	const schema: JSONSchema7 = {
		type: "object",
		properties: {
			street: { type: "string" },
			city: { type: "string" },
			zip: { type: "string" },
		},
	};
	const result = inferType("address", schema);
	expect(result.columnType).toEqual({
		kind: "jsonb",
		schema,
	});
	expect(result.isEnum).toBe(false);
});

test("inline object with required and additionalProperties preserves JSON Schema", () => {
	const schema: JSONSchema7 = {
		type: "object",
		required: ["street", "city"],
		properties: {
			street: { type: "string" },
			city: { type: "string" },
			zip: { type: "string" },
		},
		additionalProperties: false,
	};
	const result = inferType("address", schema);
	expect(result.columnType).toEqual({
		kind: "jsonb",
		schema,
	});
	expect(result.isEnum).toBe(false);
});

test("empty object has no schema", () => {
	const schema: JSONSchema7 = { type: "object" };
	const result = inferType("unstructured", schema);
	expect(result.columnType).toEqual({ kind: "jsonb" });
	expect(result.isEnum).toBe(false);
});

test("nested inline objects preserve hierarchy", () => {
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
	const result = inferType("person", schema);
	expect(result.columnType).toEqual({
		kind: "jsonb",
		schema,
	});
	expect(result.isEnum).toBe(false);
});

test("array of inline objects preserves schema", () => {
	const itemsSchema: JSONSchema7 = {
		type: "object",
		properties: {
			name: { type: "string" },
			value: { type: "number" },
		},
	};
	const schema: JSONSchema7 = {
		type: "array",
		items: itemsSchema,
	};
	const result = inferType("items", schema);
	expect(result.columnType).toEqual({
		kind: "array",
		inner: {
			kind: "jsonb",
			schema: itemsSchema,
		},
	});
	expect(result.isEnum).toBe(false);
});

test("object with description only has no schema", () => {
	const schema: JSONSchema7 = {
		type: "object",
		description: "Unstructured object",
	};
	const result = inferType("settings", schema);
	expect(result.columnType).toEqual({ kind: "jsonb" });
	expect(result.isEnum).toBe(false);
});

test("array of strings maps to TEXT[]", () => {
	const schema: JSONSchema7 = {
		type: "array",
		items: { type: "string" },
	};
	const result = inferType("tags", schema);
	expect(result.columnType).toEqual({
		kind: "array",
		inner: { kind: "text" },
	});
	expect(result.isEnum).toBe(false);
});

test("array of integers maps to INTEGER[]", () => {
	const schema: JSONSchema7 = {
		type: "array",
		items: { type: "integer" },
	};
	const result = inferType("numbers", schema);
	expect(result.columnType).toEqual({
		kind: "array",
		inner: { kind: "integer" },
	});
	expect(result.isEnum).toBe(false);
});

test("array of uuids maps to UUID[]", () => {
	const schema: JSONSchema7 = {
		type: "array",
		items: { type: "string", format: "uuid" },
	};
	const result = inferType("tagIds", schema);
	expect(result.columnType).toEqual({
		kind: "array",
		inner: { kind: "uuid" },
	});
	expect(result.isEnum).toBe(false);
});

test("array with refTarget should be handled by relation inference", () => {
	const schema: JSONSchema7 = {
		type: "array",
		items: { $ref: "#/definitions/User" },
	};
	const result = inferType("users", schema, "User");
	// For refs in arrays, we use the ref target (will be converted to FK or join table)
	expect(result.columnType).toEqual({ kind: "text" });
	expect(result.isEnum).toBe(false);
});

test("property with $ref maps to reference column", () => {
	const schema: JSONSchema7 = { $ref: "#/definitions/User" };
	const result = inferType("author", schema, "User");
	// For refs, we default to UUID (will be converted to FK column)
	expect(result.columnType).toEqual({ kind: "uuid" });
	expect(result.isEnum).toBe(false);
});

test("array of objects maps to JSONB[]", () => {
	const schema: JSONSchema7 = {
		type: "array",
		items: { type: "object" },
	};
	const result = inferType("items", schema);
	expect(result.columnType).toEqual({
		kind: "array",
		inner: { kind: "jsonb" },
	});
	expect(result.isEnum).toBe(false);
});

test("enum with mixed types defaults to TEXT", () => {
	const schema: JSONSchema7 = {
		type: "string",
		enum: ["a", "b", 1] as (string | number)[],
	};
	const result = inferType("field", schema);
	expect(result.columnType).toEqual({ kind: "text" });
	expect(result.isEnum).toBe(false);
});
