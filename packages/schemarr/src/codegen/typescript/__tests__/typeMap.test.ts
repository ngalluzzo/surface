import { describe, expect, test } from "bun:test";
import type { ColumnType } from "../../../lib/types";
import { mapTypeToTs } from "../typeMap";

describe("TypeScript type mapping", () => {
	test("maps text to string", () => {
		const type: ColumnType = { kind: "text" };
		expect(mapTypeToTs(type)).toBe("string");
	});

	test("maps varchar to string", () => {
		const type: ColumnType = { kind: "varchar", maxLength: 255 };
		expect(mapTypeToTs(type)).toBe("string");
	});

	test("maps uuid to string", () => {
		const type: ColumnType = { kind: "uuid" };
		expect(mapTypeToTs(type)).toBe("string");
	});

	test("maps integer to number", () => {
		const type: ColumnType = { kind: "integer" };
		expect(mapTypeToTs(type)).toBe("number");
	});

	test("maps bigint to number", () => {
		const type: ColumnType = { kind: "bigint" };
		expect(mapTypeToTs(type)).toBe("number");
	});

	test("maps double_precision to number", () => {
		const type: ColumnType = { kind: "double_precision" };
		expect(mapTypeToTs(type)).toBe("number");
	});

	test("maps boolean to boolean", () => {
		const type: ColumnType = { kind: "boolean" };
		expect(mapTypeToTs(type)).toBe("boolean");
	});

	test("maps date to string (ISO date)", () => {
		const type: ColumnType = { kind: "date" };
		expect(mapTypeToTs(type)).toBe("string");
	});

	test("maps timestamp to string (ISO datetime)", () => {
		const type: ColumnType = { kind: "timestamp" };
		expect(mapTypeToTs(type)).toBe("string");
	});

	test("maps timestamptz to string (ISO datetime)", () => {
		const type: ColumnType = { kind: "timestamptz" };
		expect(mapTypeToTs(type)).toBe("string");
	});

	test("maps json to unknown", () => {
		const type: ColumnType = { kind: "json" };
		expect(mapTypeToTs(type)).toBe("unknown");
	});

	test("maps jsonb to unknown", () => {
		const type: ColumnType = { kind: "jsonb" };
		expect(mapTypeToTs(type)).toBe("unknown");
	});

	test("maps serial to number", () => {
		const type: ColumnType = { kind: "serial" };
		expect(mapTypeToTs(type)).toBe("number");
	});

	test("maps bigserial to number", () => {
		const type: ColumnType = { kind: "bigserial" };
		expect(mapTypeToTs(type)).toBe("number");
	});

	test("maps array to Array<T>", () => {
		const type: ColumnType = {
			kind: "array",
			inner: { kind: "text" },
		};
		expect(mapTypeToTs(type)).toBe("Array<string>");
	});

	test("maps enum to string (placeholder for enum name)", () => {
		const type: ColumnType = {
			kind: "enum",
			enumName: "UserRole",
		};
		expect(mapTypeToTs(type)).toBe("UserRole");
	});
});
