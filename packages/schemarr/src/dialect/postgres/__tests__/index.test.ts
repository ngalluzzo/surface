import { describe, expect, test } from "bun:test";
import type { TableIR } from "../../../lib/types";
import { postgresDialect } from "../index";

describe("postgres dialect index", () => {
	test("dialect has all required functions", () => {
		expect(postgresDialect.name).toBe("postgres");
		expect(typeof postgresDialect.mapType).toBe("function");
		expect(typeof postgresDialect.emitColumn).toBe("function");
		expect(typeof postgresDialect.emitConstraint).toBe("function");
		expect(typeof postgresDialect.emitIndex).toBe("function");
		expect(typeof postgresDialect.emitTable).toBe("function");
		expect(typeof postgresDialect.emitEnum).toBe("function");
		expect(typeof postgresDialect.quoteIdentifier).toBe("function");
	});

	test("dialect functions work correctly", () => {
		const table: TableIR = {
			name: "test",
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

		const result = postgresDialect.emitTable(table);
		expect(result).toContain('"id" UUID NOT NULL');
		expect(result).toContain('CREATE TABLE "test"');
		expect(result).toContain(");");
	});
});
