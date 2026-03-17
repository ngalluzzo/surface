import type { JSONSchema7 } from "json-schema";
import type { ParseError, RefError } from "../lib/errors";
import { refError } from "../lib/errors";
import type { Result } from "../lib/result";
import { collect, err, isErr, isOk, ok } from "../lib/result";
import {
	detectComposition,
	isSchemaObject,
	mergeAllOfProperties,
} from "./resolveComposition";
import type {
	RawObjectDef,
	RawSchemaIR,
	ResolvedObjectDef,
	ResolvedProperty,
	ResolvedSchemaIR,
} from "./types";

const REF_PREFIX = "#/definitions/";

/**
 * Extract definition name from a $ref string.
 * Returns undefined if schema has no $ref.
 */
const extractRefName = (schema: JSONSchema7): string | undefined => {
	// Direct $ref on the property
	if (schema.$ref?.startsWith(REF_PREFIX) === true) {
		return schema.$ref.slice(REF_PREFIX.length);
	}

	// $ref inside array items
	if (
		schema.type === "array" &&
		typeof schema.items === "object" &&
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		schema.items !== null &&
		!Array.isArray(schema.items)
	) {
		const { items } = schema;
		if (items.$ref?.startsWith(REF_PREFIX) === true) {
			return items.$ref.slice(REF_PREFIX.length);
		}
	}

	return undefined;
};

/**
 * Get the raw $ref string from a schema (for error reporting).
 */
const extractRawRef = (schema: JSONSchema7): string | undefined => {
	if (schema.$ref !== undefined) return schema.$ref;
	if (
		schema.type === "array" &&
		typeof schema.items === "object" &&
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		schema.items !== null &&
		!Array.isArray(schema.items)
	) {
		const items = schema.items as { $ref?: string };
		return items.$ref;
	}
	return undefined;
};

/**
 * Resolve a single property within an object definition.
 */
const resolveProperty = (
	propName: string,
	propSchema: JSONSchema7,
	required: boolean,
	definitions: ReadonlyMap<string, RawObjectDef>,
	parentPath: string,
): Result<ResolvedProperty, RefError> => {
	const refName = extractRefName(propSchema);

	if (refName !== undefined) {
		if (!definitions.has(refName)) {
			const rawRef = extractRawRef(propSchema) ?? refName;
			return err(refError.unresolved(rawRef, `${parentPath}.${propName}`));
		}

		return ok({
			name: propName,
			schema: propSchema,
			required,
			refTarget: refName,
		});
	}

	return ok({
		name: propName,
		schema: propSchema,
		required,
	});
};

/**
 * Resolve all properties of an object definition.
 */
const resolveObjectDef = (
	objDef: RawObjectDef,
	definitions: ReadonlyMap<string, RawObjectDef>,
): Result<ResolvedObjectDef, RefError | ParseError> => {
	const { schema } = objDef;

	// Check for composition (allOf/oneOf)
	const compositionResult = detectComposition(schema, definitions);

	if (isOk(compositionResult)) {
		// Handle composition
		switch (compositionResult.value.kind) {
			case "allOf": {
				const allOfSchemas = schema.allOf?.filter(isSchemaObject) ?? [];
				const mergedResult = mergeAllOfProperties(
					allOfSchemas,
					definitions,
					objDef.name,
				);

				if (isErr(mergedResult)) {
					return err(mergedResult.error);
				}

				if (!isOk(mergedResult)) {
					return err({
						kind: "invalid_json",
						message: "Failed to merge allOf properties",
					});
				}

				const schemaExtension = schema as JSONSchema7 & {
					"x-unique"?: readonly string[];
				};
				const uniqueColumns = schemaExtension["x-unique"];

				return ok({
					name: objDef.name,
					properties: mergedResult.value,
					isRoot: objDef.isRoot,
					...(uniqueColumns !== undefined && { uniqueColumns }),
					composition: compositionResult.value,
				});
			}

			case "oneOf": {
				// For oneOf, we still need to extract properties from alternatives
				// For now, just create empty properties and store the composition info
				const schemaExtension = schema as JSONSchema7 & {
					"x-unique"?: readonly string[];
				};
				const uniqueColumns = schemaExtension["x-unique"];

				return ok({
					name: objDef.name,
					properties: [],
					isRoot: objDef.isRoot,
					...(uniqueColumns !== undefined && { uniqueColumns }),
					composition: compositionResult.value,
				});
			}
		}
	}

	// No composition - handle normally
	const properties = schema.properties ?? {};
	const requiredSet = new Set(schema.required ?? []);

	const resolvedResults: Result<ResolvedProperty, RefError>[] = [];

	for (const [propName, propSchema] of Object.entries(properties)) {
		if (
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			propSchema === null ||
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			propSchema === undefined ||
			typeof propSchema !== "object"
		)
			continue;

		resolvedResults.push(
			resolveProperty(
				propName,
				propSchema,
				requiredSet.has(propName),
				definitions,
				objDef.name,
			),
		);
	}

	const collected = collect(resolvedResults);
	if (isErr(collected)) return collected;

	const schemaExtension = schema as JSONSchema7 & {
		"x-unique"?: readonly string[];
	};
	const uniqueColumns = schemaExtension["x-unique"];

	return ok({
		name: objDef.name,
		properties: isOk(collected) ? collected.value : [],
		isRoot: objDef.isRoot,
		...(uniqueColumns !== undefined && { uniqueColumns }),
	});
};

/**
 * Resolve all $ref pointers in a parsed schema.
 *
 * Single-pass, non-recursive: iterates the flat definitions map.
 * Circular refs (A→B→A) resolve naturally without infinite recursion.
 */
export const resolveRefs = (
	raw: RawSchemaIR,
): Result<ResolvedSchemaIR, RefError | ParseError> => {
	// Resolve root
	const rootResult = resolveObjectDef(raw.root, raw.definitions);
	if (isErr(rootResult)) return rootResult;

	// Resolve each definition
	const resolvedDefs = new Map<string, ResolvedObjectDef>();

	for (const [defName, defObj] of raw.definitions) {
		const defResult = resolveObjectDef(defObj, raw.definitions);
		if (isErr(defResult)) return defResult;
		if (isOk(defResult)) {
			resolvedDefs.set(defName, defResult.value);
		}
	}

	if (isOk(rootResult)) {
		return ok({
			root: rootResult.value,
			definitions: resolvedDefs,
		});
	}

	// This should never happen since we returned earlier if rootResult is an error
	return err({ kind: "invalid_json", message: "Failed to resolve schema" });
};
