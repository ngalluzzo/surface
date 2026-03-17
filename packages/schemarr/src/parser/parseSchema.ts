import type { JSONSchema7 } from "json-schema";
import type { ParseError } from "../lib/errors";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { RawObjectDef, RawSchemaIR, ValidatedSchema } from "./types";

/**
 * Extract an object definition from a schema
 */
const extractObjectDef = (
	name: string,
	schema: JSONSchema7,
	isRoot = false,
): RawObjectDef => ({
	name,
	schema,
	isRoot,
});

/**
 * Process definitions and filter only object-type definitions
 */
const processDefinitions = (
	definitions: JSONSchema7["definitions"],
): ReadonlyMap<string, RawObjectDef> => {
	if (!definitions || typeof definitions !== "object") {
		return new Map();
	}

	const result = new Map<string, RawObjectDef>();

	for (const [defName, defSchema] of Object.entries(definitions)) {
		// Only process object-type definitions
		if (
			typeof defSchema === "object" &&
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			defSchema !== null &&
			"type" in defSchema &&
			defSchema.type === "object"
		) {
			const objectDef = extractObjectDef(defName, defSchema, false);
			result.set(defName, objectDef);
		}
	}

	return result;
};

/**
 * Parse JSON Schema into RawSchemaIR
 *
 * Extracts the root object and all object definitions,
 * preserving $ref strings for later resolution.
 */
export const parseSchema = (
	validatedSchema: ValidatedSchema,
): Result<RawSchemaIR, ParseError> => {
	try {
		const { title, schema } = validatedSchema;

		// Extract root definition
		const rootDef = extractObjectDef(title, schema, true);

		// Process definitions
		const definitions = processDefinitions(schema.definitions);

		return ok({
			root: rootDef,
			definitions,
		});
	} catch (error) {
		return err({
			kind: "invalid_schema",
			message: `Failed to parse schema: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}
};
