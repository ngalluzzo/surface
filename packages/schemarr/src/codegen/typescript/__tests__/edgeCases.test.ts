import { describe, expect, test } from "bun:test";
import type { SchemaIR, TableIR } from "../../../lib/types";
import { emitTsEnum } from "../emitEnum";
import { emitTsObject } from "../emitObject";
import { emitTsSchema } from "../emitSchema";

describe("TypeScript emitter edge cases", () => {
	test("handles empty columns array", () => {
		const table: TableIR = {
			name: "empty",
			columns: [],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		// Empty table has extra newline in the braces
		expect(result).toContain("export type Empty = {");
		expect(result).toContain("};");
	});

	test("handles all nullable columns", () => {
		const table: TableIR = {
			name: "all_nullable",
			columns: [
				{
					name: "a",
					type: { kind: "text" },
					nullable: true,
					isPrimaryKey: false,
				},
				{
					name: "b",
					type: { kind: "integer" },
					nullable: true,
					isPrimaryKey: false,
				},
				{
					name: "c",
					type: { kind: "boolean" },
					nullable: true,
					isPrimaryKey: false,
				},
			],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type AllNullable");
		expect(result).toContain("a: string | null");
		expect(result).toContain("b: number | null");
		expect(result).toContain("c: boolean | null");
	});

	test("handles snake_case table names", () => {
		const table: TableIR = {
			name: "user_profiles",
			columns: [
				{
					name: "id",
					type: { kind: "uuid" },
					nullable: false,
					isPrimaryKey: true,
				},
			],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type UserProfiles");
	});

	test("handles single enum value", () => {
		const enumDef = {
			name: "BinaryStatus",
			values: ["on"],
		};

		const result = emitTsEnum(enumDef);

		expect(result).toContain("export type BinaryStatus = 'on';");
	});

	test("handles many enum values", () => {
		const enumDef = {
			name: "ManyStatus",
			values: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
		};

		const result = emitTsEnum(enumDef);

		expect(result).toContain("export type ManyStatus =");
		expect(result).toContain("'a'");
		expect(result).toContain("'b'");
		expect(result).toContain("'c'");
		expect(result).toContain("'j'");
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

	test("handles only enums", () => {
		const schema: SchemaIR = {
			name: "EnumOnlySchema",
			tables: [],
			enums: [
				{ name: "Status", values: ["open", "closed"] },
				{ name: "Priority", values: ["low", "high"] },
			],
		};

		const result = emitTsSchema(schema);

		expect(result).toContain("export type Status =");
		expect(result).toContain("export type Priority =");
		expect(result).not.toContain("export type EnumOnlySchema");
	});

	test("handles only tables", () => {
		const schema: SchemaIR = {
			name: "TableOnlySchema",
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
		expect(result).not.toContain("export type TableOnlySchema");
	});

	test("handles foreign key dependencies", () => {
		const schema: SchemaIR = {
			name: "FkSchema",
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
							name: "user_id",
							type: { kind: "uuid" },
							nullable: false,
							isPrimaryKey: false,
						},
					],
					constraints: [
						{
							kind: "foreign_key",
							columns: ["user_id"],
							refTable: "users",
							refColumns: ["id"],
							onDelete: "cascade",
							onUpdate: "cascade",
						},
					],
					indexes: [],
				},
			],
			enums: [],
		};

		const result = emitTsSchema(schema);

		// Users should come before Posts (dependency order)
		const usersIndex = result.indexOf("export type Users");
		const postsIndex = result.indexOf("export type Posts");

		expect(usersIndex).toBeGreaterThan(-1);
		expect(postsIndex).toBeGreaterThan(-1);
		expect(usersIndex).toBeLessThan(postsIndex);
	});
});
