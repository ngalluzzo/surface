import { type Dependency, topologicalSort } from "../../lib/topologicalSort";
import type { SchemaIR, TableIR } from "../../lib/types";
import { emitZodEnum } from "./emitEnum";
import { emitZodObject } from "./emitObject";

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

export const emitZodSchema = (schema: SchemaIR): string => {
	const lines: string[] = [];

	lines.push('import { z } from "zod";');
	lines.push("");
	lines.push("// --- Enums ---");
	lines.push("");

	if (schema.enums.length > 0) {
		for (const enumDef of schema.enums) {
			lines.push(emitZodEnum(enumDef));
			lines.push("");
		}
	}

	lines.push("// --- Schemas ---");
	lines.push("");

	if (schema.tables.length > 0) {
		const tableDependencies = getTableDependencies(schema.tables);
		const sortedTables = topologicalSort(tableDependencies);

		for (const tableDep of sortedTables) {
			const table = schema.tables.find((t) => t.name === tableDep.name);
			if (table) {
				lines.push(emitZodObject(table));
				lines.push("");
			}
		}
	}

	return lines.join("\n").trimEnd();
};
