import type { ColumnIR } from "../../lib/types";
import { mapType } from "./typeMap";

/**
 * Quote an identifier for PostgreSQL.
 * PostgreSQL uses double quotes for identifiers.
 */
export const quoteIdentifier = (name: string): string => `"${name}"`;

/**
 * Emit column comments as COMMENT ON COLUMN statements.
 */
export const emitColumnComments = (
	tableName: string,
	columns: readonly ColumnIR[],
): string[] => {
	const comments: string[] = [];
	for (const col of columns) {
		if (col.comment !== undefined) {
			comments.push(
				`COMMENT ON COLUMN ${quoteIdentifier(tableName)}.${quoteIdentifier(col.name)} IS ${escapeLiteral(col.comment)};`,
			);
		}
	}
	return comments;
};

/**
 * Escape a string literal for PostgreSQL.
 * Single quotes are escaped by doubling them.
 */
const escapeLiteral = (value: string): string =>
	`'${value.replace(/'/g, "''")}'`;

/**
 * Emit a default value clause.
 */
const emitDefault = (def: ColumnIR["default"]): string | null => {
	if (!def) return null;

	if (def.kind === "literal") {
		if (typeof def.value === "string") {
			return `DEFAULT ${escapeLiteral(def.value)}`;
		}
		return `DEFAULT ${String(def.value)}`;
	}

	return `DEFAULT ${def.expression}`;
};

/**
 * Emit a full column definition.
 * Format: "name" TYPE [NOT NULL] [DEFAULT value]
 *
 * Note: Comments are NOT emitted inline as they're invalid in PostgreSQL.
 * They should be emitted separately as COMMENT ON COLUMN statements.
 */
export const emitColumn = (col: ColumnIR): string => {
	const parts: string[] = [quoteIdentifier(col.name), mapType(col.type)];

	if (!col.nullable) {
		parts.push("NOT NULL");
	}

	const defaultValue = emitDefault(col.default);
	if (defaultValue !== null) {
		parts.push(defaultValue);
	}

	return parts.join(" ");
};
