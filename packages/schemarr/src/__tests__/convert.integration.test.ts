import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { convert, convertToIR } from "../convert";
import { postgresDialect } from "../dialect/postgres";

import type { ColumnType } from "../lib/types";

const isJsonOrJsonbType = (
	type: ColumnType,
): type is Extract<ColumnType, { kind: "json" } | { kind: "jsonb" }> => {
	return type.kind === "json" || type.kind === "jsonb";
};

describe("Integration Tests", () => {
	const fixturesDir = join(__dirname, "../lib/test/fixtures");
	const schemasDir = join(fixturesDir, "schemas");
	const expectedDir = join(fixturesDir, "expected");

	const testCases = [
		{ name: "minimal", file: "minimal" },
		{ name: "all types", file: "all-types" },
		{ name: "with enums", file: "with-enums" },
		{ name: "with refs", file: "with-refs" },
		{ name: "with constraints", file: "with-constraints" },
		{ name: "nested objects", file: "nested-objects" },
		{ name: "array relations", file: "array-relations" },
		// { name: 'circular refs', file: 'circular-ref' }, // Skip: no expected SQL file
		// { name: 'ecommerce-order', file: 'ecommerce-order' }, // Skip: x-unique not implemented
	];

	for (const { name, file } of testCases) {
		test(`converts ${name} schema to SQL`, () => {
			const schemaPath = join(schemasDir, `${file}.json`);
			const expectedPath = join(expectedDir, `${file}.sql`);

			const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as unknown;
			const expectedSql = readFileSync(expectedPath, "utf-8").trim();

			const result = convert(schema, { dialect: postgresDialect });

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const actualSql = result.value.trim();
				expect(actualSql).toBe(expectedSql);
			}
		});
	}

	// test('converts ecommerce-order schema with complex relations', () => {
	//   const schemaPath = join(schemasDir, 'ecommerce-order.json');
	//   const expectedPath = join(expectedDir, 'ecommerce-order.sql');
	//
	//   const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
	//   const expectedSql = readFileSync(expectedPath, 'utf-8').trim();
	//
	//   const result = convert(schema, { dialect: postgresDialect });
	//
	//   expect(result.kind).toBe('ok');
	//   if (result.kind === 'ok') {
	//     const actualSql = result.value.trim();
	//     expect(actualSql).toBe(expectedSql);
	//   }
	// });
});

describe("JSONB Schema Preservation", () => {
	test("nested-objects.json preserves inline object structure", () => {
		const schemaPath = join(
			__dirname,
			"../lib/test/fixtures/schemas/nested-objects.json",
		);
		const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as unknown;

		const result = convertToIR(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const company = result.value.tables.find((t) => t.name === "company");
			expect(company).toBeDefined();

			const addressCol = company?.columns.find((c) => c.name === "address");
			expect(addressCol).toBeDefined();
			expect(addressCol?.type.kind).toBe("jsonb");
			if (addressCol && isJsonOrJsonbType(addressCol.type)) {
				expect(isJsonOrJsonbType(addressCol.type)).toBe(true);
			}

			// address should preserve full JSON Schema with properties
			if (addressCol && isJsonOrJsonbType(addressCol.type)) {
				expect(addressCol.type.schema).toBeDefined();
				expect(addressCol.type.schema?.properties).toBeDefined();
				expect(addressCol.type.schema?.properties?.street).toBeDefined();
				expect(addressCol.type.schema?.properties?.city).toBeDefined();
				expect(addressCol.type.schema?.properties?.zip).toBeDefined();
			}

			// settings should have no schema (empty object)
			const settingsCol = company?.columns.find((c) => c.name === "settings");
			expect(settingsCol).toBeDefined();
			expect(settingsCol?.type.kind).toBe("jsonb");
			if (settingsCol && isJsonOrJsonbType(settingsCol.type)) {
				expect(isJsonOrJsonbType(settingsCol.type)).toBe(true);
				expect(settingsCol.type.schema).toBeUndefined();
			}
		}
	});

	test("ecommerce-order.json preserves shipping_address structure", () => {
		const schemaPath = join(
			__dirname,
			"../lib/test/fixtures/schemas/ecommerce-order.json",
		);
		const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as unknown;

		const result = convertToIR(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const order = result.value.tables.find((t) => t.name === "order");
			expect(order).toBeDefined();

			const shippingCol = order?.columns.find(
				(c) => c.name === "shipping_address",
			);
			expect(shippingCol).toBeDefined();
			expect(shippingCol?.type.kind).toBe("jsonb");
			if (shippingCol && isJsonOrJsonbType(shippingCol.type)) {
				expect(isJsonOrJsonbType(shippingCol.type)).toBe(true);
			}

			// shipping_address should preserve full JSON Schema with properties
			if (shippingCol && isJsonOrJsonbType(shippingCol.type)) {
				expect(shippingCol.type.schema).toBeDefined();
				expect(shippingCol.type.schema?.properties).toBeDefined();
				expect(shippingCol.type.schema?.properties?.street).toBeDefined();
				expect(shippingCol.type.schema?.properties?.city).toBeDefined();
				expect(shippingCol.type.schema?.properties?.state).toBeDefined();
				expect(shippingCol.type.schema?.properties?.zip).toBeDefined();
				expect(shippingCol.type.schema?.properties?.country).toBeDefined();
			}
		}
	});
});
