import type { TableIR } from "../../lib/types";
import { toPascalCase } from "./naming";
import { mapTypeToTs } from "./typeMap";

export const emitTsObject = (table: TableIR): string => {
	const typeName = toPascalCase(table.name);
	const lines: string[] = [];

	lines.push(`export type ${typeName} = {`);

	if (table.columns.length > 0) {
		table.columns.forEach((column) => {
			const baseType = mapTypeToTs(column.type);
			const fieldType = column.nullable ? `${baseType} | null` : baseType;
			lines.push(`  ${column.name}: ${fieldType};`);
		});
	}

	lines.push("};");

	return lines.join("\n");
};
