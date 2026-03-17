import type {
	ColumnIR,
	ColumnType,
	ConstraintIR,
	EnumIR,
	SchemaIR,
	TableIR,
} from "../lib/types";

export type CodegenEmitter = {
	readonly name: string;
	readonly mapType: (type: ColumnType) => string;
	readonly emitField: (
		col: ColumnIR,
		checks: readonly ConstraintIR[],
	) => string;
	readonly emitEnum: (enumDef: EnumIR) => string;
	readonly emitObject: (table: TableIR) => string;
	readonly emitSchema: (schema: SchemaIR) => string;
};
