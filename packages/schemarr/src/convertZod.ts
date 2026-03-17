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
import type { ParseZodOptions } from "./parser/parseZod";
import { parseZodSchema } from "./parser/parseZod";
import { resolveRefs } from "./parser/resolveRefs";
import { validateSchema } from "./parser/validateSchema";
import { toTableIR } from "./transform/toTableIR";
import type { NamingStrategy, TransformOptions } from "./transform/types";

export type LoadZodError = {
	readonly kind: "zod_load_error";
	readonly message: string;
};

export type ConvertZodError =
	| ParseError
	| RefError
	| TransformError
	| EmitError
	| LoadZodError;

export type ConvertZodOptions = {
	/** How to handle inline objects without $ref: "jsonb" or "separate_table" */
	inlineObjectStrategy?: "jsonb" | "separate_table";

	/** How to handle array of $ref without x-relation hint */
	defaultArrayRefRelation?: "one_to_many" | "many_to_many";

	/** Custom naming strategy (defaults to snake_case) */
	naming?: Partial<NamingStrategy>;

	/** SQL dialect to use (currently only 'postgres') */
	dialect?: SqlDialect;

	/** Options to pass to z.toJSONSchema() */
	zod?: ParseZodOptions;
};

/**
 * Default naming strategy (same as in convert.ts).
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
 * Convert a Zod schema to SQL DDL.
 *
 * Pipeline:
 * 1. Convert Zod schema to JSON Schema using z.toJSONSchema()
 * 2. Add title if missing (required by validateSchema)
 * 3. Validate the JSON Schema
 * 4. Parse it into RawSchemaIR
 * 5. Resolve $ref pointers
 * 6. Transform to SchemaIR (tables, columns, constraints, enums)
 * 7. Emit SQL using the specified dialect
 *
 * @param schema - A Zod schema
 * @param options - Conversion options
 * @returns Result with SQL string or error
 */
export const convertZodToSql = async <T = unknown>(
	schema: T,
	options: ConvertZodOptions = {},
): Promise<Result<string, ConvertZodError>> => {
	// Set defaults
	const { dialect } = options;
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Convert Zod to JSON Schema
	const zodResult = await parseZodSchema(schema, options.zod);
	if (zodResult.kind === "err") {
		return err(zodResult.error);
	}

	let { schema: jsonSchema } = zodResult.value;

	// Step 2: Add title if missing (required by validateSchema)
	if (!jsonSchema.title && zodResult.value.title === "") {
		jsonSchema = { ...jsonSchema, title: "Schema" };
	}

	// Step 3: Validate schema
	const validated = validateSchema(jsonSchema);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 4: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 5: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 6: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	// Step 7: Emit SQL
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
 * Convert a Zod schema to Zod validation code (normalized).

 * Pipeline:
 * 1. Convert Zod schema to JSON Schema
 * 2. Add title if missing
 * 3. Validate the JSON Schema
 * 4. Pass through existing transform pipeline
 * 5. Emit normalized Zod code
 *
 * @param schema - A Zod schema
 * @param options - Conversion options (zod options only, no dialect needed)
 * @returns Result with Zod code string or error
 */
export const convertZodToZod = async <T = unknown>(
	schema: T,
	options: Omit<ConvertZodOptions, "dialect"> = {},
): Promise<Result<string, ConvertZodError>> => {
	// Set defaults
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Convert Zod to JSON Schema
	const zodResult = await parseZodSchema(schema, options.zod);
	if (zodResult.kind === "err") {
		return err(zodResult.error);
	}

	let { schema: jsonSchema } = zodResult.value;

	// Step 2: Add title if missing
	if (!jsonSchema.title && zodResult.value.title === "") {
		jsonSchema = { ...jsonSchema, title: "Schema" };
	}

	// Step 3: Validate schema
	const validated = validateSchema(jsonSchema);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 4: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 5: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 6: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	// Step 7: Emit Zod code
	const zodCode = emitZodSchema(schemaIR);
	return ok(zodCode);
};

/**
 * Convert a Zod schema to TypeScript type definitions.
 *
 * Pipeline:
 * 1. Convert Zod schema to JSON Schema
 * 2. Add title if missing
 * 3. Validate the JSON Schema
 * 4. Pass through existing transform pipeline
 * 5. Emit TypeScript types
 *
 * @param schema - A Zod schema
 * @param options - Conversion options (zod options only, no dialect needed)
 * @returns Result with TypeScript type definitions string or error
 */
export const convertZodToTypes = async <T = unknown>(
	schema: T,
	options: Omit<ConvertZodOptions, "dialect"> = {},
): Promise<Result<string, ConvertZodError>> => {
	// Set defaults
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Convert Zod to JSON Schema
	const zodResult = await parseZodSchema(schema, options.zod);
	if (zodResult.kind === "err") {
		return err(zodResult.error);
	}

	let { schema: jsonSchema } = zodResult.value;

	// Step 2: Add title if missing
	if (!jsonSchema.title && zodResult.value.title === "") {
		jsonSchema = { ...jsonSchema, title: "Schema" };
	}

	// Step 3: Validate schema
	const validated = validateSchema(jsonSchema);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 4: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 5: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 6: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	// Step 7: Emit TypeScript types
	const tsCode = emitTsSchema(schemaIR);
	return ok(tsCode);
};

/**
 * Convert a Zod schema to SchemaIR (intermediate representation).

 * Useful for debugging or when you want to inspect the IR before emitting SQL.
 *
 * @param schema - A Zod schema
 * @param options - Conversion options (zod options only, no dialect needed)
 * @returns Result with SchemaIR or error
 */
export const convertZodToIR = async <T = unknown>(
	schema: T,
	options: Omit<ConvertZodOptions, "dialect"> = {},
): Promise<Result<SchemaIR, ConvertZodError>> => {
	// Set defaults
	const naming = {
		...defaultNamingStrategy,
		...options.naming,
	} as NamingStrategy;
	const defaultArrayRefRelation =
		options.defaultArrayRefRelation ?? "one_to_many";
	const inlineObjectStrategy = options.inlineObjectStrategy ?? "jsonb";

	// Step 1: Convert Zod to JSON Schema
	const zodResult = await parseZodSchema(schema, options.zod);
	if (zodResult.kind === "err") {
		return err(zodResult.error);
	}

	let { schema: jsonSchema } = zodResult.value;

	// Step 2: Add title if missing
	if (!jsonSchema.title && zodResult.value.title === "") {
		jsonSchema = { ...jsonSchema, title: "Schema" };
	}

	// Step 3: Validate schema
	const validated = validateSchema(jsonSchema);
	if (validated.kind === "err") {
		return err(validated.error);
	}

	// Step 4: Parse schema
	const parsed = parseSchema(validated.value);
	if (parsed.kind === "err") {
		return err(parsed.error);
	}

	// Step 5: Resolve refs
	const resolved = resolveRefs(parsed.value);
	if (resolved.kind === "err") {
		return err(resolved.error);
	}

	// Step 6: Transform to SchemaIR
	const transformOptions: TransformOptions = {
		naming,
		defaultArrayRefRelation,
		inlineObjectStrategy,
	};
	const schemaIR = toTableIR(resolved.value, transformOptions);

	return ok(schemaIR);
};

/**
 * Convert a Zod schema (object-shaped) to GraphQL types.
 * Pipeline: parseZodSchema → default title → validate → parse → resolve → emitGraphQL.
 */
export type ConvertZodToGraphQLOptions = {
	/** Name for the root type (used as title when Zod output has no title). */
	rootName?: string;
	/** Build input types (for args) or output types (for return). */
	mode: "input" | "output";
	/** Options to pass to z.toJSONSchema() */
	zod?: ParseZodOptions;
};

export const convertZodToGraphQL = async <T = unknown>(
	schema: T,
	options: ConvertZodToGraphQLOptions,
): Promise<Result<EmitGraphQLResult, ConvertZodError>> => {
	const { rootName, mode, zod: zodOptions } = options;

	const zodResult = await parseZodSchema(schema, zodOptions);
	if (zodResult.kind === "err") return err(zodResult.error);

	let { schema: jsonSchema, title } = zodResult.value;
	if (!jsonSchema.title && title === "") {
		jsonSchema = { ...jsonSchema, title: rootName ?? "Schema" };
	}

	const validated = validateSchema(jsonSchema);
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
