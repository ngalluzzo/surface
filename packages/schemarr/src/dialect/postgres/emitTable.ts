import type { TableIR } from "../../lib/types";
import { emitColumn } from "./emitColumn";
import { emitConstraint } from "./emitConstraint";

/**
 * Emit a CREATE TABLE statement.
 * Format:
 * CREATE TABLE "table_name" (
 *   "col1" TYPE [NOT NULL] [DEFAULT ...],
 *   "col2" TYPE ...,
 *   CONSTRAINT "name" ...,
 *   ...
 * );
 */
export const emitTable = (table: TableIR): string => {
	const columns = table.columns.map((c) => `  ${emitColumn(c)}`).join(",\n");
	const constraints = table.constraints
		.map((c) => `  ${emitConstraint(c, table.name)}`)
		.join(",\n");

	const body = [columns, constraints].filter(Boolean).join(",\n");

	return `CREATE TABLE "${table.name}" (\n${body}\n);`;
};
