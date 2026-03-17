import { describe, expect, test } from "bun:test";
import type { SchemaIR } from "../../../lib/types";
import { typescriptEmitter } from "../index";

describe("TypeScript emitter index", () => {
	test("has correct name", () => {
		expect(typescriptEmitter.name).toBe("typescript");
	});

	test("has mapType function", () => {
		expect(typeof typescriptEmitter.mapType).toBe("function");
	});

	test("mapType returns correct TypeScript types", () => {
		const result = typescriptEmitter.mapType({ kind: "text" });
		expect(result).toBe("string");
	});

	test("has emitEnum function", () => {
		expect(typeof typescriptEmitter.emitEnum).toBe("function");
	});

	test("has emitObject function", () => {
		expect(typeof typescriptEmitter.emitObject).toBe("function");
	});

	test("has emitSchema function", () => {
		expect(typeof typescriptEmitter.emitSchema).toBe("function");
	});

	test("emitSchema generates complete output", () => {
		const schema: SchemaIR = {
			name: "TestSchema",
			tables: [
				{
					name: "users",
					columns: [
						{
							name: "id",
							type: { kind: "uuid" },
							nullable: false,
							isPrimaryKey: true,
						},
						{
							name: "name",
							type: { kind: "text" },
							nullable: true,
							isPrimaryKey: false,
						},
					],
					constraints: [],
					indexes: [],
				},
			],
			enums: [
				{
					name: "Role",
					values: ["admin", "user"],
				},
			],
		};

		const result = typescriptEmitter.emitSchema(schema);

		expect(result).toContain("export type Role =");
		expect(result).toContain("'admin' | 'user'");
		expect(result).toContain("export type Users =");
		expect(result).toContain("id: string");
		expect(result).toContain("name: string | null");
	});

	test("emitField is not supported", () => {
		expect(() => {
			typescriptEmitter.emitField(
				{
					name: "test",
					type: { kind: "text" },
					nullable: false,
					isPrimaryKey: false,
				},
				[],
			);
		}).toThrow("emitField is not supported for TypeScript emitter");
	});
});
