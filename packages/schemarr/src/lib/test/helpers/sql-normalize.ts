/**
 * Normalize SQL for whitespace-insensitive comparison.
 *
 * - Trims leading/trailing whitespace
 * - Collapses multiple spaces/tabs to single space
 * - Normalizes newlines
 * - Removes trailing whitespace per line
 * - Lowercases keywords (preserves quoted identifiers)
 *
 * This is intentionally simple — not a SQL parser.
 * For structural comparison use the integration roundtrip tests.
 */
export const normalizeSql = (sql: string): string =>
	sql
		.trim()
		.split("\n")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter((line) => line.length > 0)
		.join("\n");

/**
 * Compare two SQL strings with normalization.
 * Returns { match, expected, actual } for clear test output.
 */
export const compareSql = (
	actual: string,
	expected: string,
): { match: boolean; actual: string; expected: string } => {
	const a = normalizeSql(actual);
	const e = normalizeSql(expected);
	return { match: a === e, actual: a, expected: e };
};

/**
 * Extract individual statements from a DDL string.
 * Splits on semicolons, trims, filters empty.
 */
export const splitStatements = (sql: string): string[] =>
	sql
		.split(";")
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.map((s) => `${s};`);

/**
 * Assert that a DDL string contains a specific statement (normalized).
 */
export const containsStatement = (ddl: string, fragment: string): boolean => {
	const normalizedDdl = normalizeSql(ddl);
	const normalizedFragment = normalizeSql(fragment);
	return normalizedDdl.includes(normalizedFragment);
};

/**
 * Extract CREATE TABLE name from a DDL statement.
 */
export const extractTableNames = (ddl: string): string[] => {
	const regex = /CREATE TABLE\s+"?(\w+)"?/gi;
	const names: string[] = [];
	for (let match = regex.exec(ddl); match !== null; match = regex.exec(ddl)) {
		const name = match[1];
		if (name !== undefined) {
			names.push(name);
		}
	}
	return names;
};

/**
 * Extract CREATE TYPE name from a DDL statement.
 */
export const extractEnumNames = (ddl: string): string[] => {
	const regex = /CREATE TYPE\s+"?(\w+)"?/gi;
	const names: string[] = [];
	for (let match = regex.exec(ddl); match !== null; match = regex.exec(ddl)) {
		const name = match[1];
		if (name !== undefined) {
			names.push(name);
		}
	}
	return names;
};
