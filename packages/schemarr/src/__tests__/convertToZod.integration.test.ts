import { describe, expect, test } from "bun:test";
import { convertToZod } from "../convert";
import {
	loadExpectedZod,
	loadSchemaFixture,
} from "../lib/test/helpers/load-fixtures";
import { normalizeTs } from "../lib/test/helpers/ts-normalize";

describe("Zod Integration Tests", () => {
	const testCases = [
		{ name: "minimal", file: "minimal" },
		{ name: "all types", file: "all-types" },
		{ name: "with enums", file: "with-enums" },
		{ name: "with refs", file: "with-refs" },
		{ name: "self ref", file: "self-ref" },
		{ name: "with constraints", file: "with-constraints" },
		{ name: "composite constraints", file: "composite-constraints" },
		{ name: "nested objects", file: "nested-objects" },
		{ name: "array relations", file: "array-relations" },
	];

	for (const { name, file } of testCases) {
		test(`converts ${name} schema to Zod`, () => {
			const schema = loadSchemaFixture(file);
			const expectedZod = loadExpectedZod(file);

			const result = convertToZod(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const actualZod = normalizeTs(result.value);
				const expectedNormalized = normalizeTs(expectedZod);
				expect(actualZod).toBe(expectedNormalized);
			}
		});
	}
});
