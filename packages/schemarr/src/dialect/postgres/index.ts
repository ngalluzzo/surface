import type { SqlDialect } from "../types";
import { emitColumn, emitColumnComments, quoteIdentifier } from "./emitColumn";
import { emitConstraint } from "./emitConstraint";
import { emitEnum } from "./emitEnum";
import { emitIndex } from "./emitIndex";
import { emitTable } from "./emitTable";
import { mapType } from "./typeMap";

/**
 * PostgreSQL dialect implementation.
 *
 * Pure functions for converting IR to PostgreSQL SQL strings.
 * No state, no classes, just function composition.
 */
export const postgresDialect: SqlDialect = {
	name: "postgres",
	mapType,
	emitColumn,
	emitConstraint,
	emitIndex,
	emitTable,
	emitColumnComments,
	emitEnum,
	quoteIdentifier,
};
