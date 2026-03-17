import type {
	ColumnIR,
	ColumnType,
	ConstraintIR,
	EnumIR,
} from "../../lib/types";

/**
 * Target for a foreign key: the referenced table's export id and column property key.
 */
export type DrizzleRefTarget = {
	readonly tableId: string;
	readonly columnKey: string;
};

/**
 * A dialect that emits Drizzle ORM table definitions (TypeScript code).
 * Same idea as SqlDialect: bag of pure functions, IR → TS fragments.
 * No runtime dependency on drizzle-orm; output is string only.
 */
export type DrizzleDialect = {
	readonly name: string;

	/** Table name (snake_case) → export identifier (camelCase) */
	readonly toTableId: (tableName: string) => string;

	/** Column name (snake_case) → object property key (camelCase) */
	readonly toPropertyKey: (columnName: string) => string;

	/** Imports required at the top of the generated file */
	readonly getImports: () => readonly { module: string; names: string[] }[];

	/** Map column type + name to Drizzle builder start, e.g. `uuid("id")` or `text("id")` */
	readonly mapType: (type: ColumnType, columnName: string) => string;

	/** Emit one column's value (rhs of " key: value "). Includes .notNull(), .primaryKey(), .references(() => ref), etc. */
	readonly emitColumn: (col: ColumnIR, refTarget?: DrizzleRefTarget) => string;

	/** Emit a full table export: `export const tableId = pgTable("name", { ... });` or with constraint callback */
	readonly emitTable: (
		tableName: string,
		tableId: string,
		columnEntries: ReadonlyArray<[string, string]>,
		constraints: readonly ConstraintIR[],
	) => string;

	/** Emit enum export, e.g. `export const xEnum = pgEnum("x", [...]);`. Return empty string if dialect inlines enums. */
	readonly emitEnum: (enumDef: EnumIR) => string;

	/** Enum DB name → export identifier (e.g. "cycle_status" → "cycleStatusEnum"). Used when emitEnum returns non-empty. */
	readonly enumExportName?: (enumName: string) => string;
};
