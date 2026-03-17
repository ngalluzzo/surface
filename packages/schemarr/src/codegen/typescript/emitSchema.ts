import { type Dependency, topologicalSort } from "../../lib/topologicalSort";
import type { SchemaIR, TableIR } from "../../lib/types";
import { emitTsEnum } from "./emitEnum";
import { emitTsObject } from "./emitObject";

const getDependenciesForTable = (table: TableIR): string[] => {
	const deps: string[] = [];
	for (const constraint of table.constraints) {
		if (constraint.kind === "foreign_key") {
			deps.push(constraint.refTable);
		}
	}
	return deps;
};

const getTableDependencies = (tables: readonly TableIR[]): Dependency[] => {
	return tables.map((table) => ({
		name: table.name,
		dependsOn: getDependenciesForTable(table),
	}));
};

export const emitTsSchema = (schema: SchemaIR): string => {
	const lines: string[] = [];

	// Emit enums first
	if (schema.enums.length > 0) {
		for (const enumDef of schema.enums) {
			lines.push(emitTsEnum(enumDef));
			lines.push("");
		}
	}

	// Emit tables (topologically sorted)
	if (schema.tables.length > 0) {
		const tableDependencies = getTableDependencies(schema.tables);
		const sortedTables = topologicalSort(tableDependencies);

		for (const tableDep of sortedTables) {
			const table = schema.tables.find((t) => t.name === tableDep.name);
			if (table) {
				lines.push(emitTsObject(table));
				lines.push("");
			}
		}
	}

	return lines.join("\n").trimEnd();
};
