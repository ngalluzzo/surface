import type { ConstraintIR, TableIR } from "../../lib/types";
import { type EmitFieldContext, emitField } from "./emitField";
import { toPascalCase, toSchemaVarName } from "./naming";

const getChecksForColumn = (
	constraints: readonly ConstraintIR[],
	columnName: string,
): Extract<ConstraintIR, { kind: "check" }>[] => {
	const checks: Extract<ConstraintIR, { kind: "check" }>[] = [];
	for (const constraint of constraints) {
		if (constraint.kind === "check") {
			const { expression } = constraint;
			if (expression.includes(columnName)) {
				checks.push(constraint);
			}
		}
	}
	return checks;
};

const getSingleColumnUnique = (
	constraints: readonly ConstraintIR[],
	columnName: string,
): boolean => {
	for (const constraint of constraints) {
		if (
			constraint.kind === "unique" &&
			constraint.columns.length === 1 &&
			constraint.columns[0] === columnName
		) {
			return true;
		}
	}
	return false;
};

const getForeignKeyForColumn = (
	constraints: readonly ConstraintIR[],
	columnName: string,
): { refTable: string; refColumns: readonly string[] } | null => {
	for (const constraint of constraints) {
		if (
			constraint.kind === "foreign_key" &&
			constraint.columns.length === 1 &&
			constraint.columns[0] === columnName
		) {
			return {
				refTable: constraint.refTable,
				refColumns: constraint.refColumns,
			};
		}
	}
	return null;
};

const getCompositeUniques = (
	constraints: readonly ConstraintIR[],
): { columns: readonly string[] }[] => {
	const composites: { columns: readonly string[] }[] = [];
	for (const constraint of constraints) {
		if (constraint.kind === "unique" && constraint.columns.length > 1) {
			composites.push({ columns: constraint.columns });
		}
	}
	return composites;
};

export const emitZodObject = (table: TableIR): string => {
	const schemaVarName = toSchemaVarName(table.name);
	const typeName = toPascalCase(table.name);

	const lines: string[] = [];

	const compositeUniques = getCompositeUniques(table.constraints);
	for (const cu of compositeUniques) {
		lines.push(`// unique: [${cu.columns.join(", ")}]`);
	}

	if (table.columns.length === 0) {
		lines.push(`export const ${schemaVarName} = z.object({});`);
		lines.push(`export type ${typeName} = z.infer<typeof ${schemaVarName}>;`);
		return lines.join("\n");
	}

	lines.push(`export const ${schemaVarName} = z.object({`);

	table.columns.forEach((column) => {
		if (column.comment !== undefined) {
			lines.push(`  // ${column.comment}`);
		}

		const checks = getChecksForColumn(table.constraints, column.name);
		const ctx: EmitFieldContext = { checks };

		const fieldCode = emitField(column, ctx);

		let suffix = ",";
		const isUnique = getSingleColumnUnique(table.constraints, column.name);
		if (isUnique) {
			suffix += " // unique";
		}

		const fk = getForeignKeyForColumn(table.constraints, column.name);
		if (fk) {
			suffix += ` // FK -> ${fk.refTable}.${fk.refColumns.join(".")}`;
		}

		const unsupportedCheck = checks.find((c) => {
			const { expression } = c;
			return expression.includes(" AND ") || expression.includes(" OR ");
		});
		if (unsupportedCheck) {
			suffix += ` // CHECK: ${unsupportedCheck.expression}`;
		}

		if (fieldCode.includes("\n")) {
			const fieldLines = fieldCode.split("\n");
			lines.push(`  ${column.name}: ${fieldLines[0]}`);
			for (let i = 1; i < fieldLines.length; i++) {
				const line = fieldLines[i];
				if (i === fieldLines.length - 1) {
					lines.push(`    ${line}${suffix}`);
				} else {
					lines.push(`    ${line}`);
				}
			}
		} else {
			lines.push(`  ${column.name}: ${fieldCode}${suffix}`);
		}
	});

	lines.push("});");
	lines.push(`export type ${typeName} = z.infer<typeof ${schemaVarName}>;`);

	return lines.join("\n");
};
