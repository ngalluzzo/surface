import type { EnumIR } from "../../lib/types";

/**
 * Emit a CREATE TYPE ... AS ENUM statement.
 * Format: CREATE TYPE "enum_name" AS ENUM ('value1', 'value2', ...)
 */
export const emitEnum = (enumDef: EnumIR): string => {
	const values = enumDef.values
		.map((v) => `'${v.replace(/'/g, "''")}'`)
		.join(", ");
	return `CREATE TYPE "${enumDef.name}" AS ENUM (${values});`;
};
