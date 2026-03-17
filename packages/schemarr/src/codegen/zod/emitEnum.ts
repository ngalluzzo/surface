import type { EnumIR } from "../../lib/types";
import { toPascalCase, toSchemaVarName } from "./naming";

export const emitZodEnum = (enumDef: EnumIR): string => {
	const schemaVarName = toSchemaVarName(enumDef.name);
	const typeName = toPascalCase(enumDef.name);

	const escapedValues = enumDef.values.map(
		(value) => `"${value.replace(/"/g, '\\"')}"`,
	);

	let valuesStr: string;
	if (escapedValues.length > 3) {
		const indentedValues = escapedValues.map((v) => `  ${v}`).join(",\n");
		valuesStr = `[\n${indentedValues},\n]`;
	} else {
		valuesStr = `[${escapedValues.join(", ")}]`;
	}

	return `export const ${schemaVarName} = z.enum(${valuesStr});\nexport type ${typeName} = z.infer<typeof ${schemaVarName}>;`;
};
