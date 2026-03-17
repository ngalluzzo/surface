import type { SqlDialect } from "../dialect/types";
import { type Dependency, topologicalSort } from "../lib/topologicalSort";
import type { SchemaIR, TableIR } from "../lib/types";

/**
 * Emit a complete schema DDL script.
 *
 * Order matters:
 * 1. ENUMs first (tables may reference them)
 * 2. Tables in dependency order (FKs must reference existing tables)
 * 3. Indexes after all tables (they reference tables)
 */
export const emitSchema = (schema: SchemaIR, dialect: SqlDialect): string => {
	const parts: string[] = [];

	// Emit enums first
	for (const enumDef of schema.enums) {
		parts.push(dialect.emitEnum(enumDef));
	}

	// Emit tables in topological order based on FK dependencies
	const orderedTables = topologicalOrder(schema.tables);
	for (const table of orderedTables) {
		parts.push(dialect.emitTable(table));

		// Emit column comments for this table
		const comments = dialect.emitColumnComments(table.name, table.columns);
		for (const comment of comments) {
			parts.push(comment);
		}

		// Emit indexes for this table
		for (const index of table.indexes) {
			parts.push(`${dialect.emitIndex(index, table.name)};`);
		}
	}

	// Join statements with double newlines
	return parts.filter(Boolean).join("\n\n");
};

/**
 * Topologically sort tables by FK dependencies.
 *
 * Tables with no FK dependencies come first.
 * Tables that reference other tables come after their dependencies.
 */
const topologicalOrder = (tables: readonly TableIR[]): TableIR[] => {
	const dependencies: Dependency[] = tables.map((table) => ({
		name: table.name,
		dependsOn: table.constraints
			.filter((constraint) => constraint.kind === "foreign_key")
			.map((constraint) => constraint.refTable),
	}));

	return topologicalSort(dependencies).map((dep) => {
		const table = tables.find((t) => t.name === dep.name);
		if (!table) {
			throw new Error(`Table "${dep.name}" not found`);
		}
		return table;
	});
};
