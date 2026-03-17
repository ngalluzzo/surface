import { emitTsSchema } from "./codegen/typescript/emitSchema";
import { emitZodSchema } from "./codegen/zod/emitZodSchema";
import type { SqlDialect } from "./dialect/types";
import type { EmitGraphQLResult } from "./emit/emitGraphQL";
import { emitGraphQL } from "./emit/emitGraphQL";
import { emitSchema } from "./emit/emitSchema";
import type {
	EmitError,
	ParseError,
	RefError,
	TransformError,
} from "./lib/errors";
import type { Result } from "./lib/result";
import { err, ok } from "./lib/result";
import type { SchemaIR } from "./lib/types";
import { parseSchema } from "./parser/parseSchema";
import { resolveRefs } from "./parser/resolveRefs";
import { validateSchema } from "./parser/validateSchema";
import { toTableIR } from "./transform/toTableIR";
import type { NamingStrategy, TransformOptions } from "./transform/types";

export type ConvertError = ParseError | RefError | TransformError | EmitError;

export type ConvertZodError =
	| ParseError
	| RefError
	| TransformError
	| EmitError;

export type ConvertToTypesOptions = Omit<ConvertOptions, "dialect">;

export type ConvertOptions = {
	/** How to handle inline objects without $ref: "jsonb" or "separate_table" */
	inlineObjectStrategy?: "jsonb" | "separate_table";

	/** How to handle array of $ref without x-relation hint */
	defaultArrayRefRelation?: "one_to_many" | "many_to_many";

	/** Custom naming strategy (defaults to snake_case) */
	naming?: Partial<NamingStrategy>;

	/** SQL dialect to use (currently only 'postgres') */
	dialect?: SqlDialect;
};

/**
 * Default naming strategy.
 */
export const defaultNamingStrategy = {
	toTableName: (name: string): string =>
		name
			.split(/(?=[A-Z])/)
			.join("_")
			.toLowerCase(),
	toColumnName: (name: string): string =>
		name
			.split(/(?=[A-Z])/)
			.join("_")
			.toLowerCase(),
	toFkColumnName: (refName: string): string => `${refName.toLowerCase()}_id`,
	toJoinTableName: (a: string, b: string): string =>
		`${a.toLowerCase()}_${b.toLowerCase()}`,
	toConstraintName: (
		tableName: string,
		kind: string,
		columns: readonly string[],
	): string => {
		const colPart = columns.join("_");
		switch (kind) {
			case "primary_key":
				return `${tableName.toLowerCase()}_pkey`;
			case "foreign_key":
				return `${tableName.toLowerCase()}_${colPart}_fkey`;
			case "unique":
				return `${tableName.toLowerCase()}_${colPart}_key`;
			case "check":
				return `${tableName.toLowerCase()}_${colPart}_check`;
			default:
				return `${tableName.toLowerCase()}_${kind}_${colPart}`;
		}
	},
	toEnumName: (tableName: string, propertyName: string): string =>
		`${tableName.toLowerCase()}_${propertyName.toLowerCase()}`,
	toIndexName: (tableName: string, columns: readonly string[]): string =>
		`${tableName.toLowerCase()}_${columns.join("_")}_idx`,
};

/**
 * Convert a JSON Schema to SQL DDL.
 *
 * Pipeline:
 * 1. Validate the JSON Schema
 * 2. Parse it into RawSchemaIR
 * 3. Resolve $ref pointers
 * 4. Transform to SchemaIR (tables, columns, constraints, enums)
 * 5. Emit SQL using the specified dialect
 *
 * @param input - Raw JSON Schema object
 * @param options - Conversion options
 * @returns Result with SQL string or error
 */
export const convert = (
	input: unknown,
	options: ConvertOptions = {},
): Result<string, ConvertError> => {
	// Set defaults
	const { dialect } = options;
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Validate schema
	const validated = validateSchema(input);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 2: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 3: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 4: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	// Step 5: Emit SQL
	if (!dialect) {
		return err({
			kind: "invalid_schema",
			message: "Dialect is required",
		});
	}
	const sql = emitSchema(schemaIR, dialect);

	return ok(sql);
};

/**
 * Convert a JSON Schema to SchemaIR (intermediate representation).
 *
 * Useful for debugging or when you want to inspect the IR before emitting SQL.
 */
export const convertToIR = (
	input: unknown,
	options: Omit<ConvertOptions, "dialect"> = {},
): Result<SchemaIR, ConvertError> => {
	// Set defaults
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Validate schema
	const validated = validateSchema(input);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 2: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 3: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 4: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	return ok(schemaIR);
};

/**
 * Convert a JSON Schema to Zod validation code.
 *
 * Pipeline:
 * 1. Validate the JSON Schema
 * 2. Parse it into RawSchemaIR
 * 3. Resolve $ref pointers
 * 4. Transform to SchemaIR (tables, columns, constraints, enums)
 * 5. Emit Zod validation code
 *
 * @param input - Raw JSON Schema object
 * @param options - Conversion options (same as convertToIR)
 * @returns Result with Zod code string or error
 */
export const convertToZod = (
	input: unknown,
	options: Omit<ConvertOptions, "dialect"> = {},
): Result<string, ConvertError> => {
	// Set defaults
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Validate schema
	const validated = validateSchema(input);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 2: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 3: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 4: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	// Step 5: Emit Zod code
	const zodCode = emitZodSchema(schemaIR);
	return ok(zodCode);
};

/**
 * Convert a JSON Schema to TypeScript type definitions.
 *
 * Pipeline:
 * 1. Validate the JSON Schema
 * 2. Parse it into RawSchemaIR
 * 3. Resolve $ref pointers
 * 4. Transform to SchemaIR (tables, columns, constraints, enums)
 * 5. Emit TypeScript type definitions
 *
 * @param input - Raw JSON Schema object
 * @param options - Conversion options (same as convertToIR)
 * @returns Result with TypeScript type definitions string or error
 */
export const convertToTypes = (
	input: unknown,
	options: Omit<ConvertOptions, "dialect"> = {},
): Result<string, ConvertError> => {
	// Set defaults
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Validate schema
	const validated = validateSchema(input);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 2: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 3: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 4: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	// Step 5: Emit TypeScript types
	const tsCode = emitTsSchema(schemaIR);
	return ok(tsCode);
};

/**
 * Convert a JSON Schema (object-shaped) to GraphQL types.
 * Uses the same validate → parse → resolve pipeline but skips toTableIR;
 * emits GraphQL input or output type for the root object.
 */
export type ConvertToGraphQLOptions = {
	/** Used as schema title when input has no title (e.g. "RegisterInput"). */
	rootName?: string;
	/** Build input types (for args) or output types (for return). */
	mode: "input" | "output";
};

export const convertToGraphQL = (
	input: unknown,
	options: ConvertToGraphQLOptions,
): Result<EmitGraphQLResult, ConvertError> => {
	const { rootName, mode } = options;
	let schema = input as Record<string, unknown>;
	if (!schema.title) schema = { ...schema, title: rootName ?? "Schema" };
	const validated = validateSchema(schema);
	if (validated.kind === "err") return err(validated.error);
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") return err(parsed.error);
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") return err(resolved.error);
	const result = emitGraphQL(resolved.value, {
		namePrefix: validated.value.title,
		mode,
	});
	return ok(result);
};

export type { LoadZodError } from "./convertZod";
// Re-export Zod conversion functions from convertZod module
export {
	type ConvertZodOptions,
	convertZodToIR,
	convertZodToSql,
	convertZodToTypes,
	convertZodToZod,
} from "./convertZod";
