import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "..", "fixtures");

/**
 * Load a JSON schema fixture by name (without extension).
 * e.g. loadSchemaFixture("minimal") → parsed JSON object
 */
export const loadSchemaFixture = (name: string): unknown => {
	const path = resolve(fixturesDir, "schemas", `${name}.json`);
	const raw = readFileSync(path, "utf-8");
	return JSON.parse(raw);
};

/**
 * Load an expected SQL fixture by name (without extension).
 * e.g. loadExpectedSql("minimal") → raw SQL string
 */
export const loadExpectedSql = (name: string): string => {
	const path = resolve(fixturesDir, "expected", `${name}.sql`);
	return readFileSync(path, "utf-8");
};

/**
 * Load an expected Zod fixture by name (without extension).
 * e.g. loadExpectedZod("minimal") → raw TypeScript string
 */
export const loadExpectedZod = (name: string): string => {
	const path = resolve(fixturesDir, "expected", `${name}.zod.ts`);
	return readFileSync(path, "utf-8");
};

/**
 * Load a fixture pair: input JSON schema + expected SQL output.
 */
export const loadFixturePair = (
	name: string,
): { schema: unknown; expectedSql: string } => ({
	schema: loadSchemaFixture(name),
	expectedSql: loadExpectedSql(name),
});

/**
 * All fixture names for parameterized tests.
 */
export const allFixtureNames = [
	"minimal",
	"all-types",
	"with-refs",
	"nested-objects",
	"array-relations",
	"with-enums",
	"with-constraints",
	"ecommerce-order",
] as const;

export type FixtureName = (typeof allFixtureNames)[number];
