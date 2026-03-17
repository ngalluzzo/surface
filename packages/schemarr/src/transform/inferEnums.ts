import type { ColumnType, EnumIR } from "../lib/types";
import type { InferEnumInput, InferEnumResult, NamingStrategy } from "./types";

/**
 * Infer an enum definition and the corresponding column type from
 * a property that has `enum` values defined.
 */
export const inferEnums = (
	input: InferEnumInput,
	naming: NamingStrategy,
): InferEnumResult => {
	const { propertyName, tableName, values } = input;

	const enumName = naming.toEnumName(tableName, propertyName);

	const enumDef: EnumIR = {
		name: enumName,
		values,
	};

	const columnType: ColumnType = {
		kind: "enum",
		enumName,
	};

	return {
		enumDef,
		columnType,
	};
};
