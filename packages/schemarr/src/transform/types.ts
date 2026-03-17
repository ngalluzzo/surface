import type { JSONSchema7 } from "json-schema";
import type { ColumnType, ConstraintIR, EnumIR } from "../lib/types";

// ============================================================
// Transform-layer types
//
// Input/output shapes for each transform function.
// Each function is a small, focused transform with
// explicit types rather than stringly-typed data.
// ============================================================

/**
 * Input to inferTypes: a single JSON Schema property
 * with its context.
 */
export type InferTypeInput = {
	readonly propertyName: string;
	readonly schema: JSONSchema7;
	readonly refTarget?: string;
};

/**
 * Output of inferTypes.
 */
export type InferTypeResult = {
	readonly columnType: ColumnType;
	readonly isEnum: boolean;
};

/**
 * Input to inferConstraints: a single property with
 * table-level context.
 */
export type InferConstraintInput = {
	readonly propertyName: string;
	readonly columnName: string;
	readonly schema: JSONSchema7;
	readonly required: boolean;
	readonly tableName: string;
	readonly startingCheckCount?: number;
};

/**
 * Output of inferConstraints: constraints and next check count.
 */
export type InferConstraintOutput = {
	readonly constraints: readonly ConstraintIR[];
	readonly nextCheckCount: number;
};

/**
 * Describes a detected relation between two entities.
 */
export type RelationKind = "one_to_one" | "one_to_many" | "many_to_many";

export type InferredRelation = {
	readonly kind: RelationKind;
	readonly sourceTable: string;
	readonly sourceProperty: string;
	readonly targetDef: string;
	readonly isRequired: boolean;
};

/**
 * Input to inferEnums: a property that has `enum` defined.
 */
export type InferEnumInput = {
	readonly propertyName: string;
	readonly tableName: string;
	readonly values: readonly string[];
};

/**
 * Result of enum inference: the enum definition + the
 * column type that references it.
 */
export type InferEnumResult = {
	readonly enumDef: EnumIR;
	readonly columnType: ColumnType;
};

/**
 * Strategy for converting names between JSON Schema and SQL conventions.
 */
export type NamingStrategy = {
	readonly toTableName: (schemaTitle: string) => string;
	readonly toColumnName: (propertyName: string) => string;
	readonly toEnumName: (tableName: string, propertyName: string) => string;
	readonly toConstraintName: (
		tableName: string,
		kind: string,
		columns: readonly string[],
	) => string;
	readonly toFkColumnName: (propertyName: string) => string;
	readonly toJoinTableName: (table1: string, table2: string) => string;
	readonly toIndexName: (
		tableName: string,
		columns: readonly string[],
	) => string;
};

/**
 * Configuration options that influence transform behavior.
 */
export type TransformOptions = {
	/** How to handle inline objects without $ref: "jsonb" or "separate_table" */
	readonly inlineObjectStrategy: "jsonb" | "separate_table";

	/** How to handle array of $ref without x-relation hint */
	readonly defaultArrayRefRelation: "one_to_many" | "many_to_many";

	/** Custom naming strategy (defaults to snake_case) */
	readonly naming: NamingStrategy;
};
