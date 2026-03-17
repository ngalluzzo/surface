import type { JSONSchema7 } from "json-schema";
import type { ParseError } from "../lib/errors";
import { parseError } from "../lib/errors";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { ValidatedSchema } from "./types";

// Zod types - we import these dynamically to avoid requiring zod at build time
// since zod is a peer dependency
type ZodTypeAny = unknown;
type ZodRegistryAny = unknown;
type ToJSONSchemaParams = unknown;

// Dynamic import function to get z at runtime
const getZod = async () => {
	try {
		const zod = await import("zod");
		return zod;
	} catch {
		throw new Error("Zod is required as a peer dependency");
	}
};

/**
 * Options for parsing Zod schemas to JSON Schema
 */
export type ParseZodOptions = {
	/** Registry to use for metadata lookup */
	metadata?: ZodRegistryAny;

	/** JSON Schema version to target (default: draft-7 for compatibility) */
	target?: "draft-4" | "draft-7" | "draft-2020-12" | "openapi-3.0";

	/** How to handle unrepresentable types (default: 'throw') */
	unrepresentable?: "throw" | "any";

	/** How to handle cycles (default: 'ref') */
	cycles?: "ref" | "throw";

	/** How to handle reused schemas (default: 'inline') */
	reused?: "ref" | "inline";

	/** Custom URI function for external $refs */
	uri?: (id: string) => string;

	/** Whether to treat input/output mode (default: 'output') */
	io?: "input" | "output";
};

/**
 * Parse a Zod schema into a ValidatedSchema.

 * Converts Zod schema to JSON Schema using z.toJSONSchema(), then
 * validates it has the required structure for the schemarr pipeline.
 *
 * @param schema - A Zod schema or Zod registry
 * @param options - Conversion options for z.toJSONSchema()
 * @returns Result with ValidatedSchema or error
 */
export const parseZodSchema = async (
	schema: ZodTypeAny,
	options: ParseZodOptions = {},
): Promise<Result<ValidatedSchema, ParseError>> => {
	try {
		const z = await getZod();

		// Check if this is a registry (has 'schemas' property when toJSONSchema'd)
		// We determine this by checking if it has typical registry methods
		const isRegistry =
			schema !== null &&
			typeof schema === "object" &&
			"add" in schema &&
			"get" in schema &&
			"has" in schema;

		// Set default options
		const toJSONOptions: ToJSONSchemaParams = {
			target: options.target ?? "draft-7",
			unrepresentable: options.unrepresentable ?? "throw",
			cycles: options.cycles ?? "ref",
			reused: options.reused ?? "inline",
			io: options.io ?? "output",
			metadata: options.metadata,
			uri: options.uri,
		};

		const toJSONSchema = (
			z as { toJSONSchema: (s: unknown, o: unknown) => unknown }
		).toJSONSchema;
		let jsonSchema: unknown;

		if (isRegistry) {
			// Convert registry to multi-schema format
			jsonSchema = toJSONSchema(schema, toJSONOptions);
		} else {
			// Convert single schema
			jsonSchema = toJSONSchema(schema, toJSONOptions);
		}

		// Handle registry output format
		if (
			jsonSchema &&
			typeof jsonSchema === "object" &&
			"schemas" in jsonSchema
		) {
			// This is a registry output with multiple schemas
			// We preserve the { schemas: { ... } } structure as-is
			const schemas = (jsonSchema as { schemas: Record<string, unknown> })
				.schemas;

			if (Object.keys(schemas).length === 0) {
				return err(parseError.invalidSchema("Registry contains no schemas"));
			}

			return ok({
				title: "registry",
				schema: jsonSchema as unknown as JSONSchema7,
			});
		}

		// Validate the resulting JSON Schema has required fields
		if (jsonSchema === null || typeof jsonSchema !== "object") {
			return err(
				parseError.invalidSchema("z.toJSONSchema() produced invalid output"),
			);
		}

		const rootSchema = jsonSchema as JSONSchema7;
		// Extract title from schema or use empty string
		const title = rootSchema.title ?? "";

		// Ensure type is 'object'
		if (rootSchema.type !== "object") {
			return err(
				parseError.invalidSchema(
					`Root schema must have type "object", got "${rootSchema.type}"`,
				),
			);
		}

		return ok({
			title,
			schema: rootSchema,
		});
	} catch (error) {
		if (error instanceof Error) {
			// Check if this is an unrepresentable type error
			if (
				error.message.includes("unrepresentable") ||
				error.message.includes("cannot be represented")
			) {
				return err(parseError.unrepresentableType(error.message));
			}

			return err(
				parseError.invalidSchema(
					`Failed to convert Zod schema: ${error.message}`,
				),
			);
		}

		return err(
			parseError.invalidSchema(
				`Unknown error converting Zod schema: ${String(error)}`,
			),
		);
	}
};
