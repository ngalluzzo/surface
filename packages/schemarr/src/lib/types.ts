import type { JSONSchema7 } from "json-schema";

// ============================================================
// IR (Intermediate Representation) types
//
// These are the canonical types that sit between JSON Schema
// parsing and SQL dialect emission. Everything converts TO
// these types, and dialects convert FROM them.
// ============================================================

// --- Column types (discriminated union) ---

export type ColumnType =
	| { readonly kind: "text" }
	| { readonly kind: "varchar"; readonly maxLength: number }
	| { readonly kind: "uuid" }
	| { readonly kind: "integer" }
	| { readonly kind: "bigint" }
	| { readonly kind: "double_precision" }
	| { readonly kind: "boolean" }
	| { readonly kind: "date" }
	| { readonly kind: "timestamp" }
	| { readonly kind: "timestamptz" }
	| { readonly kind: "json"; readonly schema?: JSONSchema7 }
	| { readonly kind: "jsonb"; readonly schema?: JSONSchema7 }
	| { readonly kind: "array"; readonly inner: ColumnType }
	| { readonly kind: "enum"; readonly enumName: string }
	| { readonly kind: "serial" }
	| { readonly kind: "bigserial" };

// --- Default values ---

export type DefaultValue =
	| { readonly kind: "literal"; readonly value: string | number | boolean }
	| { readonly kind: "expression"; readonly expression: string };

// --- Column ---

export type ColumnIR = {
	/** DB column name (snake_case); used in Drizzle calls e.g. uuid("id"). */
	readonly name: string;
	/** Object property key (camelCase) in emitted table; when set, used instead of deriving from name. */
	readonly propertyKey?: string;
	readonly type: ColumnType;
	readonly nullable: boolean;
	readonly isPrimaryKey: boolean;
	readonly default?: DefaultValue;
	readonly comment?: string;
};

// --- Constraints (discriminated union) ---

export type OnAction = "cascade" | "set_null" | "restrict" | "no_action";

export type ConstraintIR =
	| {
			readonly kind: "primary_key";
			readonly name?: string;
			readonly columns: readonly string[];
	  }
	| {
			readonly kind: "unique";
			readonly name?: string;
			readonly columns: readonly string[];
	  }
	| {
			readonly kind: "foreign_key";
			readonly name?: string;
			readonly columns: readonly string[];
			readonly refTable: string;
			readonly refColumns: readonly string[];
			readonly onDelete: OnAction;
			readonly onUpdate: OnAction;
	  }
	| {
			readonly kind: "check";
			readonly name?: string;
			readonly expression: string;
	  };

// --- Indexes ---

export type IndexMethod = "btree" | "hash" | "gin" | "gist";

export type IndexIR = {
	readonly name?: string;
	readonly columns: readonly string[];
	readonly unique: boolean;
	readonly method: IndexMethod;
};

// --- Enum ---

export type EnumIR = {
	readonly name: string;
	readonly values: readonly string[];
};

// --- Table ---

export type TableIR = {
	readonly name: string;
	readonly schema?: string;
	readonly columns: readonly ColumnIR[];
	readonly constraints: readonly ConstraintIR[];
	readonly indexes: readonly IndexIR[];
	readonly comment?: string;
};

// --- Schema (top-level) ---

export type SchemaIR = {
	readonly name: string;
	readonly tables: readonly TableIR[];
	readonly enums: readonly EnumIR[];
};
