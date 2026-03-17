import { joinBlocks, typedModule } from "../codegen/ts-utils";
import type { DrizzleDialect } from "../dialect/drizzle/types";
import { type Dependency, topologicalSort } from "../lib/topologicalSort";
import type { SchemaIR, TableIR } from "../lib/types";

const topologicalOrder = (tables: readonly TableIR[]): TableIR[] => {
	const dependencies: Dependency[] = tables.map((table) => ({
		name: table.name,
		dependsOn: table.constraints
			.filter((c) => c.kind === "foreign_key")
			.map((c) => c.refTable),
	}));
	return topologicalSort(dependencies).map((dep) => {
		const table = tables.find((t) => t.name === dep.name);
		if (!table) throw new Error(`Table "${dep.name}" not found`);
		return table;
	});
};

/**
 * Emit a complete Drizzle table definitions file (TypeScript).
 * Enums first, then tables in FK dependency order.
 * Dialect is injected (pg or sqlite).
 */
export const emitDrizzle = (
	schema: SchemaIR,
	dialect: DrizzleDialect,
	options: { headerComment?: string } = {},
): string => {
	const bodyParts: string[] = [];

	for (const enumDef of schema.enums) {
		const out = dialect.emitEnum(enumDef);
		if (out) {
			bodyParts.push(out);
		}
	}

	const orderedTables = topologicalOrder(schema.tables);
	for (const table of orderedTables) {
		const tableId = dialect.toTableId(table.name);
		const columnEntries: [string, string][] = [];

		for (const col of table.columns) {
			let refTarget: { tableId: string; columnKey: string } | undefined;
			const fk = table.constraints.find(
				(c): c is Extract<typeof c, { kind: "foreign_key" }> =>
					c.kind === "foreign_key" &&
					c.columns.length === 1 &&
					c.columns[0] === col.name,
			);
			if (fk) {
				refTarget = {
					tableId: dialect.toTableId(fk.refTable),
					columnKey: dialect.toPropertyKey(fk.refColumns[0] ?? col.name),
				};
			}
			const key = col.propertyKey ?? dialect.toPropertyKey(col.name);
			const value = dialect.emitColumn(col, refTarget);
			columnEntries.push([key, value]);
		}

		const tableCode = dialect.emitTable(
			table.name,
			tableId,
			columnEntries,
			table.constraints,
		);
		bodyParts.push(tableCode);
	}

	const body = joinBlocks(bodyParts);
	const imports = dialect.getImports();
	const importEntries = imports.map((imp) => ({
		module: imp.module,
		names: [...imp.names],
	}));

	return typedModule({
		headerComment:
			options.headerComment ?? "// AUTO-GENERATED — do not edit. Run codegen.",
		imports: importEntries,
		body,
	});
};
