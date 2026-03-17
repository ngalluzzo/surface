import { describe, expect, test } from "bun:test";
import type { SchemaIR } from "../../../lib/types";
import { emitTsSchema } from "../emitSchema";

describe("TypeScript schema emission", () => {
	test("emits complete schema with enums and tables", () => {
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
				{
					name: "posts",
					columns: [
						{
							name: "id",
							type: { kind: "uuid" },
							nullable: false,
							isPrimaryKey: true,
						},
						{
							name: "title",
							type: { kind: "text" },
							nullable: false,
							isPrimaryKey: false,
						},
					],
					constraints: [],
					indexes: [],
				},
			],
			enums: [
				{
					name: "UserRole",
					values: ["admin", "user", "guest"],
				},
			],
		};

		const result = emitTsSchema(schema);

		expect(result).toContain("export type UserRole =");
		expect(result).toContain("'admin' | 'user' | 'guest'");
		expect(result).toContain("export type Users");
		expect(result).toContain("export type Posts");
		expect(result).toContain("id: string");
		expect(result).toContain("name: string | null");
		expect(result).toContain("title: string");
	});

	test("emits schema with only tables", () => {
		const schema: SchemaIR = {
			name: "SimpleSchema",
			tables: [
				{
					name: "items",
					columns: [
						{
							name: "id",
							type: { kind: "integer" },
							nullable: false,
							isPrimaryKey: true,
						},
					],
					constraints: [],
					indexes: [],
				},
			],
			enums: [],
		};

		const result = emitTsSchema(schema);

		expect(result).toContain("export type Items");
		expect(result).toContain("id: number");
	});

	test("emits schema with only enums", () => {
		const schema: SchemaIR = {
			name: "EnumSchema",
			tables: [],
			enums: [
				{
					name: "Status",
					values: ["open", "closed"],
				},
			],
		};

		const result = emitTsSchema(schema);

		expect(result).toContain("export type Status");
		expect(result).toContain("'open' | 'closed'");
	});

	test("handles empty schema", () => {
		const schema: SchemaIR = {
			name: "EmptySchema",
			tables: [],
			enums: [],
		};

		const result = emitTsSchema(schema);

		expect(result).toBe("");
	});
});
