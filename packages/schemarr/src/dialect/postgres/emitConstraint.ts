import type { ConstraintIR } from "../../lib/types";
import { quoteIdentifier } from "./emitColumn";

/**
 * Emit an ON ACTION clause for foreign keys.
 */
const emitOnAction = (
	action: "cascade" | "set_null" | "restrict" | "no_action",
): string => {
	const formatted = action.toUpperCase().replace("_", " ");
	return `ON DELETE ${formatted}`;
};

/**
 * Emit ON UPDATE clause for foreign keys.
 */
const emitOnUpdate = (
	action: "cascade" | "set_null" | "restrict" | "no_action",
): string => {
	const formatted = action.toUpperCase().replace("_", " ");
	return `ON UPDATE ${formatted}`;
};

/**
 * Quote a list of column names.
 */
const quoteColumnList = (columns: readonly string[]): string =>
	`(${columns.map(quoteIdentifier).join(", ")})`;

/**
 * Emit a constraint clause.
 * Format: CONSTRAINT "name" KIND (columns) [REFERENCES ...] [ON ACTION]
 */
export const emitConstraint = (
	constraint: ConstraintIR,
	tableName: string,
): string => {
	let name: string;
	let nameClause: string;

	if (constraint.name !== undefined) {
		({ name } = constraint);
		nameClause = `CONSTRAINT ${quoteIdentifier(name)}`;
	} else {
		// Generate default name based on constraint kind
		switch (constraint.kind) {
			case "primary_key":
				name = `${tableName}_pkey`;
				break;
			case "unique":
				name = `${tableName}_${constraint.columns.join("_")}_key`;
				break;
			case "foreign_key":
				name = `${tableName}_${constraint.columns.join("_")}_fkey`;
				break;
			case "check": {
				// Extract first identifier from expression for default name
				const match = /^(\w+)\s*[><=]/.exec(constraint.expression);
				const suffix = match ? `_${match[1] ?? ""}` : "";
				name = `${tableName}${suffix}_check`;
				break;
			}
		}
		nameClause = `CONSTRAINT ${quoteIdentifier(name)}`;
	}

	switch (constraint.kind) {
		case "primary_key":
			return `${nameClause} PRIMARY KEY ${quoteColumnList(constraint.columns)}`;

		case "unique":
			return `${nameClause} UNIQUE ${quoteColumnList(constraint.columns)}`;

		case "foreign_key": {
			const columns = quoteColumnList(constraint.columns);
			const refColumns = quoteColumnList(constraint.refColumns);
			const refTable = quoteIdentifier(constraint.refTable);
			const parts: string[] = [
				nameClause,
				"FOREIGN KEY",
				columns,
				"REFERENCES",
				refTable,
				refColumns,
			];

			// Only emit ON DELETE/UPDATE if not no_action
			if (constraint.onDelete !== "no_action") {
				parts.push(emitOnAction(constraint.onDelete));
			}
			if (constraint.onUpdate !== "no_action") {
				parts.push(emitOnUpdate(constraint.onUpdate));
			}

			return parts.join(" ");
		}

		case "check":
			// CHECK constraint expression is SQL, not a string literal
			// For CHECK constraints, output the expression as-is without escaping
			return `${nameClause} CHECK (${constraint.expression})`;
	}
};
