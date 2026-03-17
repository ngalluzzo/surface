import pluralize from "pluralize";
import type { NamingStrategy } from "./types";

/**
 * Convert camelCase to snake_case
 */
const toSnakeCase = (str: string): string => {
	// Handle consecutive uppercase letters (acronyms) by adding underscores between them
	// when followed by a lowercase letter
	let result = str.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");
	// Add underscore before uppercase letters preceded by lowercase or numbers
	result = result.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
	// Convert to lowercase
	return result.toLowerCase();
};

/**
 * Default naming strategy using snake_case with pluralize.
 */
export const snakeCaseNamingStrategy: NamingStrategy = {
	toTableName: (schemaTitle: string): string => {
		const snake = toSnakeCase(schemaTitle);
		return pluralize(snake);
	},

	toColumnName: (propertyName: string): string => {
		return toSnakeCase(propertyName);
	},

	toEnumName: (tableName: string, propertyName: string): string => {
		return `${tableName}_${toSnakeCase(propertyName)}`;
	},

	toConstraintName: (
		tableName: string,
		kind: string,
		columns: readonly string[],
	): string => {
		const suffix =
			kind === "primary_key" ? "pkey" : kind === "foreign_key" ? "fkey" : kind;
		if (kind === "primary_key") {
			return `${tableName}_${suffix}`;
		}
		const cols = columns.join("_");
		return `${tableName}_${cols}_${suffix}`;
	},

	toFkColumnName: (propertyName: string): string => {
		const snake = toSnakeCase(propertyName);
		return snake.endsWith("_id") ? snake : `${snake}_id`;
	},

	toJoinTableName: (table1: string, table2: string): string => {
		const table1Plural = pluralize(toSnakeCase(table1));
		const table2Plural = pluralize(toSnakeCase(table2));
		const sorted = [table1Plural, table2Plural].sort();
		return sorted.join("_");
	},

	toIndexName: (tableName: string, columns: readonly string[]): string => {
		const cols = columns.join("_");
		return `${tableName}_${cols}_idx`;
	},
};
