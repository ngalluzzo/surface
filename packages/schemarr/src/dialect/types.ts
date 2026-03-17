import type {
	ColumnIR,
	ColumnType,
	ConstraintIR,
	EnumIR,
	IndexIR,
	TableIR,
} from "../lib/types";

// ============================================================
// Dialect interface
//
// Each SQL dialect implements this interface.
// The emit layer calls these functions — it never knows
// which dialect it's targeting.
// ============================================================

/**
 * A dialect is a bag of pure functions that convert IR → SQL fragments.
 * No state, no classes, just a record of functions.
 */
export type SqlDialect = {
	/** Dialect name for error messages and logging */
	readonly name: string;

	/** Map a ColumnType IR to the dialect's SQL type string */
	readonly mapType: (type: ColumnType) => string;

	/** Emit a full column definition: `"name" TYPE [NOT NULL] [DEFAULT ...]` */
	readonly emitColumn: (col: ColumnIR) => string;

	/** Emit a constraint clause: `CONSTRAINT "name" ...` */
	readonly emitConstraint: (
		constraint: ConstraintIR,
		tableName: string,
	) => string;

	/** Emit a CREATE INDEX statement */
	readonly emitIndex: (index: IndexIR, tableName: string) => string;

	/** Emit a full CREATE TABLE statement */
	readonly emitTable: (table: TableIR) => string;

	/** Emit column comments as COMMENT ON COLUMN statements */
	readonly emitColumnComments: (
		tableName: string,
		columns: readonly ColumnIR[],
	) => readonly string[];

	/** Emit a CREATE TYPE ... AS ENUM statement */
	readonly emitEnum: (enumDef: EnumIR) => string;

	/** Quote an identifier (e.g. wrapping in double quotes for pg) */
	readonly quoteIdentifier: (name: string) => string;
};
