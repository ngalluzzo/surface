import type { JSONSchema7 } from "json-schema";
import type { ParseError, RefError } from "../lib/errors";
import { parseError, refError } from "../lib/errors";
import type { Result } from "../lib/result";
import { err, isErr, isOk, ok } from "../lib/result";
import type {
	AllOfComposition,
	CompositionKind,
	OneOfComposition,
	RawObjectDef,
	ResolvedProperty,
} from "./types";

export type JSONSchema7Object = Exclude<JSONSchema7, boolean>;
export type JSONSchema7Definition = JSONSchema7Object | boolean;

/**
 * Type guard to check if a schema definition is an object (not boolean).
 */
export const isSchemaObject = (
	item: JSONSchema7Definition,
): item is JSONSchema7Object => {
	return Object.prototype.toString.call(item) === "[object Object]";
};

/**
 * Detect if an object definition uses allOf or oneOf composition.
 * Returns composition metadata if found.
 */
export const detectComposition = (
	schema: JSONSchema7,
	definitions: ReadonlyMap<string, RawObjectDef>,
): Result<CompositionKind, ParseError> => {
	// Check for allOf
	if (
		"allOf" in schema &&
		Array.isArray(schema.allOf) &&
		schema.allOf.length > 0
	) {
		// Filter to only JSONSchema7 objects (not booleans)
		const allOfSchemas = schema.allOf.filter(isSchemaObject);
		return resolveAllOf(allOfSchemas, definitions);
	}

	// Check for oneOf
	if (
		"oneOf" in schema &&
		Array.isArray(schema.oneOf) &&
		schema.oneOf.length > 0
	) {
		// Filter to only JSONSchema7 objects (not booleans)
		const oneOfSchemas = schema.oneOf.filter(isSchemaObject);
		return resolveOneOf(oneOfSchemas, definitions, schema);
	}

	// No composition
	return err(parseError.invalidSchema("No composition found"));
};

/**
 * Merge properties from allOf composition.
 * Returns the merged properties array.
 */
export const mergeAllOfProperties = (
	allOf: readonly JSONSchema7[],
	definitions: ReadonlyMap<string, RawObjectDef>,
	objectName: string,
	visited: Set<string> = new Set(),
): Result<ResolvedProperty[], RefError | ParseError> => {
	const mergedProperties: ResolvedProperty[] = [];
	const requiredSet = new Set<string>();
	const propertyMap = new Map<
		string,
		{ schema: JSONSchema7Definition; required: boolean }
	>();

	for (const item of allOf) {
		let properties: Record<string, JSONSchema7Definition> = {};
		let required: string[] = [];

		if (
			isSchemaObject(item) &&
			"$ref" in item &&
			typeof item.$ref === "string"
		) {
			// Extract from definition
			const refName = item.$ref.replace("#/definitions/", "");

			// Check for circular reference
			if (visited.has(refName)) {
				return err(refError.circular([...visited, refName]));
			}

			const def = definitions.get(refName);
			if (!def) {
				return err(refError.unresolved(item.$ref, objectName));
			}

			// Recursively merge if definition also has allOf
			if ("allOf" in def.schema && Array.isArray(def.schema.allOf)) {
				const nestedAllOf = def.schema.allOf.filter(isSchemaObject);
				const visitedCopy = new Set(visited);
				visitedCopy.add(objectName);

				const nestedResult = mergeAllOfProperties(
					nestedAllOf,
					definitions,
					refName,
					visitedCopy,
				);

				if (isErr(nestedResult)) {
					return err(nestedResult.error);
				}

				if (!isOk(nestedResult)) {
					return err({
						kind: "invalid_json",
						message: "Failed to merge nested allOf",
					});
				}

				properties = {};
				required = [];

				// Convert nested merged properties back to Record
				for (const prop of nestedResult.value) {
					properties[prop.name] = prop.schema;
					if (prop.required) {
						required.push(prop.name);
					}
				}
			} else {
				const schemaProps = def.schema.properties;
				if (
					schemaProps &&
					typeof schemaProps === "object" &&
					!Array.isArray(schemaProps)
				) {
					properties = schemaProps;
				}
				const schemaRequired = def.schema.required;
				if (Array.isArray(schemaRequired)) {
					required = schemaRequired;
				}
			}
		} else if (isSchemaObject(item)) {
			// Inline schema
			const itemProps = item.properties;
			if (
				itemProps &&
				typeof itemProps === "object" &&
				!Array.isArray(itemProps)
			) {
				properties = itemProps;
			}
			const itemRequired = item.required;
			if (Array.isArray(itemRequired)) {
				required = itemRequired;
			}
			required = Array.isArray(item.required) ? item.required : [];
		}

		// Track required properties
		for (const req of required) {
			requiredSet.add(req);
		}

		// Merge properties with conflict detection
		for (const [propName, propSchema] of Object.entries(properties)) {
			const existing = propertyMap.get(propName);

			if (existing) {
				// Check for type conflict
				const existingType = getTypeString(existing.schema);
				const newType = getTypeString(propSchema);

				if (existingType !== newType) {
					return err(
						parseError.invalidSchema(
							`Property '${propName}' has conflicting types in allOf: '${existingType}' vs '${newType}'`,
						),
					);
				}
			}

			propertyMap.set(propName, {
				schema: propSchema,
				required: requiredSet.has(propName),
			});
		}
	}

	// Convert to ResolvedProperty array
	for (const [propName, { schema, required }] of propertyMap.entries()) {
		mergedProperties.push({
			name: propName,
			schema,
			required,
		});
	}

	return ok(mergedProperties);
};

/**
 * Get a simple type string from a schema for comparison.
 */
const getTypeString = (schema: JSONSchema7Definition): string => {
	if (typeof schema !== "object") return schema ? "true" : "false";

	if (schema.type !== undefined) {
		if (Array.isArray(schema.type)) {
			return schema.type.join("|");
		}
		return schema.type;
	}

	if (schema.$ref !== undefined && typeof schema.$ref === "string") {
		return `$ref:${schema.$ref}`;
	}

	if (schema.enum !== undefined && Array.isArray(schema.enum)) {
		return `enum:[${schema.enum.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(",")}]`;
	}

	if (schema.const !== undefined) {
		return `const:${JSON.stringify(schema.const)}`;
	}

	return "complex";
};

/**
 * Resolve oneOf composition by extracting alternatives and discriminator.
 */
const resolveOneOf = (
	oneOf: readonly JSONSchema7[],
	definitions: ReadonlyMap<string, RawObjectDef>,
	parentSchema: JSONSchema7,
): Result<OneOfComposition, ParseError> => {
	const alternatives: string[] = [];

	for (const item of oneOf) {
		if (
			isSchemaObject(item) &&
			"$ref" in item &&
			typeof item.$ref === "string"
		) {
			const refName = item.$ref.replace("#/definitions/", "");
			alternatives.push(refName);
		} else {
			alternatives.push(`_inline_${String(alternatives.length)}`);
		}
	}

	// Check for OpenAPI discriminator
	const { discriminator } = parentSchema as JSONSchema7 & {
		discriminator?: unknown;
	};

	if (typeof discriminator === "object" && discriminator !== null) {
		const disc = discriminator as {
			propertyName?: string;
			mapping?: Record<string, string>;
		};
		if (typeof disc.propertyName === "string" && disc.propertyName.length > 0) {
			return ok({
				kind: "oneOf",
				discriminator: {
					propertyName: disc.propertyName,
					...(disc.mapping !== undefined && { mapping: disc.mapping }),
				},
				alternatives,
			});
		}
	}

	// Try convention-based detection: find common property with enum
	const conventionDiscriminator = detectDiscriminatorByConvention(
		oneOf,
		definitions,
	);
	if (conventionDiscriminator) {
		return ok({
			kind: "oneOf",
			discriminator: conventionDiscriminator,
			alternatives,
		});
	}

	// No discriminator found
	return ok({
		kind: "oneOf",
		alternatives,
	});
};

/**
 * Detect discriminator by convention: find common property with enum values.
 */
const detectDiscriminatorByConvention = (
	oneOf: readonly JSONSchema7[],
	definitions: ReadonlyMap<string, RawObjectDef>,
): { propertyName: string; mapping?: Record<string, string> } | null => {
	if (oneOf.length === 0) return null;

	// Collect all properties from all alternatives
	const allProperties = new Map<string, Set<string>>();

	for (const item of oneOf) {
		let properties: Record<string, JSONSchema7Definition> = {};

		if (
			isSchemaObject(item) &&
			"$ref" in item &&
			typeof item.$ref === "string"
		) {
			const refName = item.$ref.replace("#/definitions/", "");
			const def = definitions.get(refName);
			const schemaProps = def?.schema.properties;
			if (
				schemaProps &&
				typeof schemaProps === "object" &&
				!Array.isArray(schemaProps)
			) {
				properties = schemaProps;
			}
		} else if (
			isSchemaObject(item) &&
			item.properties &&
			typeof item.properties === "object" &&
			!Array.isArray(item.properties)
		) {
			({ properties } = item);
		}

		for (const [propName, propSchema] of Object.entries(properties)) {
			if (
				isSchemaObject(propSchema) &&
				"enum" in propSchema &&
				Array.isArray(propSchema.enum)
			) {
				const propSet = allProperties.get(propName);
				if (!propSet) {
					allProperties.set(propName, new Set());
				}
				const enumValues = (propSchema.enum as unknown[]).map(String);
				const targetSet = allProperties.get(propName);
				if (targetSet) {
					for (const val of enumValues) {
						targetSet.add(val);
					}
				}
			}
		}
	}

	// Find properties that appear in all alternatives with enum
	for (const [propName, values] of allProperties.entries()) {
		// A property is a good discriminator candidate if:
		// - It has enum values
		// - The number of enum values equals the number of alternatives
		if (values.size === oneOf.length) {
			return { propertyName: propName };
		}
	}

	return null;
};

/**
 * Resolve allOf composition by extracting source schema names.
 */
const resolveAllOf = (
	allOf: readonly JSONSchema7[],
	_definitions: ReadonlyMap<string, RawObjectDef>,
): Result<AllOfComposition, ParseError> => {
	const sources: string[] = [];

	for (const item of allOf) {
		if (
			isSchemaObject(item) &&
			"$ref" in item &&
			typeof item.$ref === "string"
		) {
			// Extract definition name from $ref
			const refName = item.$ref.replace("#/definitions/", "");
			sources.push(refName);
		} else {
			// Inline schema - generate a name
			sources.push(`_inline_${String(sources.length)}`);
		}
	}

	return ok({
		kind: "allOf",
		sources,
	});
};
