import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

// ============================================================
// Parser-layer types
//
// These wrap the raw json-schema types with our own structure
// to track resolution state through the pipeline.
// ============================================================

/**
 * A validated JSON Schema with its title extracted.
 * Output of validateSchema → input to parseSchema.
 */
export type ValidatedSchema = {
	readonly title: string;
	readonly schema: JSONSchema7;
};

/**
 * A single object definition extracted from the schema,
 * with refs still unresolved (raw $ref strings).
 */
export type RawObjectDef = {
	readonly name: string;
	readonly schema: JSONSchema7;
	readonly isRoot: boolean;
};

/**
 * The full parsed schema before ref resolution.
 * Contains the root object + all definitions.
 */
export type RawSchemaIR = {
	readonly root: RawObjectDef;
	readonly definitions: ReadonlyMap<string, RawObjectDef>;
};

/**
 * Property with its ref resolved to the definition name.
 * After ref resolution, we know whether a property is:
 * - a scalar (type is set)
 * - a reference to another definition (refTarget is set)
 */
export type ResolvedProperty = {
	readonly name: string;
	readonly schema: JSONSchema7Definition;
	readonly required: boolean;
	readonly refTarget?: string;
};

/**
 * Represents an allOf composition (merged schemas)
 */
export type AllOfComposition = {
	readonly kind: "allOf";
	readonly sources: readonly string[];
};

/**
 * Represents a oneOf composition with discriminator
 */
export type OneOfComposition = {
	readonly kind: "oneOf";
	readonly discriminator?: {
		readonly propertyName: string;
		readonly mapping?: Record<string, string>;
	};
	readonly alternatives: readonly string[];
};

/**
 * Union type for composition
 */
export type CompositionKind = AllOfComposition | OneOfComposition;

/**
 * An object definition with all its properties resolved.
 */
export type ResolvedObjectDef = {
	readonly name: string;
	readonly properties: readonly ResolvedProperty[];
	readonly isRoot: boolean;
	readonly uniqueColumns?: readonly string[];
	readonly composition?: CompositionKind;
};

/**
 * Fully resolved schema — refs inlined, ready for transform.
 */
export type ResolvedSchemaIR = {
	readonly root: ResolvedObjectDef;
	readonly definitions: ReadonlyMap<string, ResolvedObjectDef>;
};
