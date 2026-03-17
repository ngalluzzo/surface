import { describe, expect, test } from "bun:test";
import {
	buildCheck,
	buildColumn,
	buildEnum,
	buildForeignKey,
	buildPkColumn,
	buildPrimaryKey,
	buildTable,
	buildUnique,
} from "../../../lib/test/helpers/builders";
import { zodEmitter } from "../index";

describe("zod emitter index", () => {
	test("emitter has all required functions", () => {
		expect(zodEmitter.name).toBe("zod");
		expect(typeof zodEmitter.mapType).toBe("function");
		expect(typeof zodEmitter.emitField).toBe("function");
		expect(typeof zodEmitter.emitEnum).toBe("function");
		expect(typeof zodEmitter.emitObject).toBe("function");
		expect(typeof zodEmitter.emitSchema).toBe("function");
	});

	test("mapType works correctly", () => {
		const result = zodEmitter.mapType({ kind: "uuid" });
		expect(result).toBe("z.uuid()");
	});

	test("emitField works correctly", () => {
		const column = buildPkColumn();
		const checks: never[] = [];
		const result = zodEmitter.emitField(column, checks);
		expect(result).toBe("z.uuid()");
	});

	test("emitField filters to only check constraints", () => {
		const column = buildColumn({
			name: "age",
			type: { kind: "integer" },
			nullable: false,
			isPrimaryKey: false,
		});

		const checks = [
			buildCheck("age >= 0", "age_min"),
			buildForeignKey({
				columns: ["user_id"],
				refTable: "users",
				refColumns: ["id"],
			}),
			buildPrimaryKey(["id"], "table_pkey"),
			buildUnique(["email"], "table_email_key"),
		] as const;

		const result = zodEmitter.emitField(column, checks);

		expect(result).toContain(".min(0)");
		expect(result).not.toContain("foreign");
		expect(result).not.toContain("unique");
		expect(result).not.toContain("primary_key");
	});

	test("emitEnum works correctly", () => {
		const enumDef = buildEnum({
			name: "status",
			values: ["active", "inactive"],
		});
		const result = zodEmitter.emitEnum(enumDef);
		expect(result).toContain("export const statusSchema = z.enum");
		expect(result).toContain(
			"export type Status = z.infer<typeof statusSchema>",
		);
	});

	test("emitObject works correctly", () => {
		const table = buildTable({
			name: "users",
			columns: [buildPkColumn()],
		});
		const result = zodEmitter.emitObject(table);
		expect(result).toContain("export const usersSchema = z.object");
		expect(result).toContain("export type Users = z.infer<typeof usersSchema>");
	});

	test("emitSchema works correctly", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
					name: "users",
					columns: [buildPkColumn()],
				}),
			],
			enums: [],
		};
		const result = zodEmitter.emitSchema(schema);
		expect(result).toContain('import { z } from "zod"');
		expect(result).toContain("// --- Enums ---");
		expect(result).toContain("// --- Schemas ---");
		expect(result).toContain("export const usersSchema = z.object");
	});
});
