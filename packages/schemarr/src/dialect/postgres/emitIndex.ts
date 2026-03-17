import type { IndexIR } from "../../lib/types";

/**
 * Generate a default index name if not provided.
 * Format: table_name_column_name_idx
 */
const defaultIndexName = (
	tableName: string,
	columns: readonly string[],
): string => {
	return `${tableName}_${columns.join("_")}_idx`;
};

/**
 * Emit a CREATE INDEX statement.
 * Format: CREATE [UNIQUE] INDEX "name" ON "table" [USING method] ("col1", "col2")
 */
export const emitIndex = (index: IndexIR, tableName: string): string => {
	const name = index.name ?? defaultIndexName(tableName, index.columns);
	const uniqueClause = index.unique ? "UNIQUE " : "";
	// Output USING clause with proper spacing
	const usingClause =
		index.method !== "btree"
			? `USING ${index.method.toLowerCase()} `
			: "USING btree ";

	const columns = index.columns.map((c) => `"${c}"`).join(", ");
	return `CREATE ${uniqueClause}INDEX "${name}" ON "${tableName}" ${usingClause}(${columns})`;
};
