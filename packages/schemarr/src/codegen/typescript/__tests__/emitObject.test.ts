import { describe, expect, test } from "bun:test";
import type { TableIR } from "../../../lib/types";
import { emitTsObject } from "../emitObject";

describe("TypeScript object emission", () => {
	test("emits simple object type", () => {
		const table: TableIR = {
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
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type Users");
		expect(result).toContain("id: string");
		expect(result).toContain("name: string | null");
	});

	test("emits object with multiple columns", () => {
		const table: TableIR = {
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
				{
					name: "content",
					type: { kind: "text" },
					nullable: true,
					isPrimaryKey: false,
				},
				{
					name: "published",
					type: { kind: "boolean" },
					nullable: false,
					isPrimaryKey: false,
				},
			],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type Posts");
		expect(result).toContain("id: string");
		expect(result).toContain("title: string");
		expect(result).toContain("content: string | null");
		expect(result).toContain("published: boolean");
	});

	test("handles array columns", () => {
		const table: TableIR = {
			name: "users",
			columns: [
				{
					name: "tags",
					type: { kind: "array", inner: { kind: "text" } },
					nullable: false,
					isPrimaryKey: false,
				},
			],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type Users");
		expect(result).toContain("tags: Array<string>");
	});

	test("handles enum columns", () => {
		const table: TableIR = {
			name: "tickets",
			columns: [
				{
					name: "status",
					type: { kind: "enum", enumName: "TicketStatus" },
					nullable: false,
					isPrimaryKey: false,
				},
			],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type Tickets");
		expect(result).toContain("status: TicketStatus");
	});

	test("handles json columns", () => {
		const table: TableIR = {
			name: "settings",
			columns: [
				{
					name: "metadata",
					type: { kind: "jsonb" },
					nullable: true,
					isPrimaryKey: false,
				},
			],
			constraints: [],
			indexes: [],
		};

		const result = emitTsObject(table);

		expect(result).toContain("export type Settings");
		expect(result).toContain("metadata: unknown | null");
	});
});
