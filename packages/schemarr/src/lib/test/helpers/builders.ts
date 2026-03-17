import type {
	ColumnIR,
	ColumnType,
	ConstraintIR,
	DefaultValue,
	EnumIR,
	IndexIR,
	IndexMethod,
	OnAction,
	SchemaIR,
	TableIR,
} from "../../types";

// --- Column ---

const defaultColumn: ColumnIR = {
	name: "unnamed",
	type: { kind: "text" },
	nullable: true,
	isPrimaryKey: false,
};

export const buildColumn = (overrides: Partial<ColumnIR> = {}): ColumnIR => ({
	...defaultColumn,
	...overrides,
});

export const buildPkColumn = (overrides: Partial<ColumnIR> = {}): ColumnIR => ({
	...defaultColumn,
	name: "id",
	type: { kind: "uuid" },
	nullable: false,
	isPrimaryKey: true,
	...overrides,
});

// --- Constraint ---

export const buildPrimaryKey = (
	columns: readonly string[] = ["id"],
	name?: string,
): ConstraintIR => ({
	kind: "primary_key",
	name,
	columns,
});

export const buildForeignKey = (
	overrides: Partial<Extract<ConstraintIR, { kind: "foreign_key" }>> = {},
): Extract<ConstraintIR, { kind: "foreign_key" }> => ({
	kind: "foreign_key",
	name: undefined,
	columns: ["ref_id"],
	refTable: "other_table",
	refColumns: ["id"],
	onDelete: "no_action" as OnAction,
	onUpdate: "no_action" as OnAction,
	...overrides,
});

export const buildUnique = (
	columns: readonly string[],
	name?: string,
): ConstraintIR => ({
	kind: "unique",
	name,
	columns,
});

export const buildCheck = (
	expression: string,
	name?: string,
): ConstraintIR => ({
	kind: "check",
	name,
	expression,
});

// --- Index ---

export const buildIndex = (overrides: Partial<IndexIR> = {}): IndexIR => ({
	columns: ["unnamed"],
	unique: false,
	method: "btree" as IndexMethod,
	...overrides,
});

// --- Enum ---

export const buildEnum = (overrides: Partial<EnumIR> = {}): EnumIR => ({
	name: "unnamed_enum",
	values: ["a", "b", "c"],
	...overrides,
});

// --- Table ---

const defaultTable: TableIR = {
	name: "unnamed_table",
	columns: [buildPkColumn()],
	constraints: [buildPrimaryKey()],
	indexes: [],
};

export const buildTable = (overrides: Partial<TableIR> = {}): TableIR => ({
	...defaultTable,
	...overrides,
});

// --- Schema ---

export const buildSchema = (overrides: Partial<SchemaIR> = {}): SchemaIR => ({
	name: "test_schema",
	tables: [buildTable()],
	enums: [],
	...overrides,
});

// --- Column type shorthands ---

export const colType = {
	text: (): ColumnType => ({ kind: "text" }),
	varchar: (maxLength: number): ColumnType => ({ kind: "varchar", maxLength }),
	uuid: (): ColumnType => ({ kind: "uuid" }),
	integer: (): ColumnType => ({ kind: "integer" }),
	bigint: (): ColumnType => ({ kind: "bigint" }),
	doublePrecision: (): ColumnType => ({ kind: "double_precision" }),
	boolean: (): ColumnType => ({ kind: "boolean" }),
	date: (): ColumnType => ({ kind: "date" }),
	timestamp: (): ColumnType => ({ kind: "timestamp" }),
	timestamptz: (): ColumnType => ({ kind: "timestamptz" }),
	json: (): ColumnType => ({ kind: "json" }),
	jsonb: (): ColumnType => ({ kind: "jsonb" }),
	array: (inner: ColumnType): ColumnType => ({ kind: "array", inner }),
	enumRef: (enumName: string): ColumnType => ({ kind: "enum", enumName }),
	serial: (): ColumnType => ({ kind: "serial" }),
	bigserial: (): ColumnType => ({ kind: "bigserial" }),
} as const;

// --- Default value shorthands ---

export const defaultVal = {
	literal: (value: string | number | boolean): DefaultValue => ({
		kind: "literal",
		value,
	}),
	expression: (expression: string): DefaultValue => ({
		kind: "expression",
		expression,
	}),
} as const;
