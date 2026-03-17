import type { EnumIR } from "../../lib/types";

export const emitTsEnum = (enumDef: EnumIR): string => {
	const enumName = enumDef.name;
	const literalUnion = enumDef.values.map((v) => `'${v}'`).join(" | ");

	return `export type ${enumName} = ${literalUnion};`;
};
