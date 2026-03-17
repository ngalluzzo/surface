/**
 * Shared utilities for emitting TypeScript source code.
 * Used by Drizzle dialect and exportable for other codegen (e.g. relations).
 * No AST dependency; string-based only.
 */

const INDENT = 2;

/**
 * Convert snake_case to camelCase for use as object keys.
 */
export const snakeToCamel = (s: string): string =>
	s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Convert camelCase to snake_case for DB column names.
 */
export const camelToSnake = (s: string): string =>
	s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/**
 * Indent each line by `level` steps (each step = 2 spaces).
 */
export const indent = (lines: string[], level = 1): string => {
	const prefix = " ".repeat(INDENT * level);
	return lines.map((line) => (line.trim() ? prefix + line : "")).join("\n");
};

/**
 * Join multiple blocks with a separator (default double newline).
 */
export const joinBlocks = (blocks: string[], separator = "\n\n"): string => {
	return blocks.filter(Boolean).join(separator);
};

/**
 * Build an object literal string: `{ key1: value1, key2: value2 }`.
 * Ensures correct commas and trailing comma style.
 */
export const objectLiteral = (entries: Array<[string, string]>): string => {
	if (entries.length === 0) return "{}";
	const lines = entries.map(([k, v]) => `${k}: ${v},`);
	return `{\n${indent(lines)}\n}`;
};

/**
 * Build a chained method call: `expr.method1().method2()`.
 */
export const chainCall = (expr: string, methods: string[]): string => {
	if (methods.length === 0) return expr;
	return `${expr}.${methods.join(".")}`;
};

export type TypedModuleOptions = {
	headerComment?: string;
	imports: Array<{ module: string; names: string[] }>;
	body: string;
};

/**
 * Build a complete typed module: comment, imports, then body.
 */
export const typedModule = (options: TypedModuleOptions): string => {
	const parts: string[] = [];

	if (options.headerComment) {
		parts.push(options.headerComment.trim());
		parts.push("");
	}

	for (const { module: mod, names } of options.imports) {
		if (names.length > 0) {
			parts.push(`import { ${names.join(", ")} } from "${mod}";`);
		}
	}
	if (options.imports.length > 0) {
		parts.push("");
	}

	parts.push(options.body.trimEnd());

	return parts.join("\n");
};
