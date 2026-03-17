import type { JSONSchema7 } from "json-schema";
import type { InferTypeResult } from "./types";

/**
 * Check if a value is a valid JSONSchema7 object (not boolean, not array, not null)
 */
const isJSONSchema7Object = (
	value: unknown,
): value is JSONSchema7 & { type?: string } => {
	return (
		value !== undefined &&
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value)
	);
};

/**
 * Infer a SQL column type from a JSON Schema property.
 *
 * This function handles all JSON Schema type+format combinations
 * and maps them to PostgreSQL types according to mapping docs.
 */
export const inferType = (
	propertyName: string,
	schema: JSONSchema7,
	refTarget?: string,
): InferTypeResult => {
	// Handle enum first - takes precedence over type
	if (schema.enum && Array.isArray(schema.enum)) {
		const enumValues = schema.enum.filter(
			(v): v is string => typeof v === "string",
		);

		if (enumValues.length === schema.enum.length) {
			return {
				columnType: {
					kind: "enum",
					enumName: propertyName,
				},
				isEnum: true,
			};
		}
		// Mixed enum values - fallback to text
		return { columnType: { kind: "text" }, isEnum: false };
	}

	const schemaType = schema.type;

	if (schemaType === undefined) {
		// If there's a ref target and no type, it's a $ref reference
		if (refTarget !== undefined) {
			return {
				columnType: { kind: "uuid" },
				isEnum: false,
			};
		}
		// Missing type - default to text
		return { columnType: { kind: "text" }, isEnum: false };
	}

	// Handle arrays
	if (schemaType === "array") {
		const { items } = schema;
		if (!isJSONSchema7Object(items)) {
			return { columnType: { kind: "text" }, isEnum: false };
		}

		// For array of refs, default to text (relation inference will handle join tables)
		if (refTarget !== undefined) {
			return { columnType: { kind: "text" }, isEnum: false };
		}

		// Recursively infer the inner type
		const innerResult = inferType(propertyName, items);

		return {
			columnType: {
				kind: "array",
				inner: innerResult.columnType,
			},
			isEnum: false,
		};
	}

	// If there's a ref target for non-array types, this is a single reference
	// Default to UUID (will be handled by relation inference)
	if (refTarget !== undefined) {
		return {
			columnType: { kind: "uuid" },
			isEnum: false,
		};
	}

	// Handle string types
	if (schemaType === "string") {
		const { format } = schema;

		if (format === "uuid") {
			return { columnType: { kind: "uuid" }, isEnum: false };
		}

		if (format === "date-time") {
			return { columnType: { kind: "timestamptz" }, isEnum: false };
		}

		if (format === "date") {
			return { columnType: { kind: "date" }, isEnum: false };
		}

		// email, uri, etc. default to text
		if (
			schema.maxLength !== undefined &&
			typeof schema.maxLength === "number"
		) {
			return {
				columnType: { kind: "varchar", maxLength: schema.maxLength },
				isEnum: false,
			};
		}

		return { columnType: { kind: "text" }, isEnum: false };
	}

	// Handle integer types
	if (schemaType === "integer") {
		if (schema.format === "int64") {
			return { columnType: { kind: "bigint" }, isEnum: false };
		}
		return { columnType: { kind: "integer" }, isEnum: false };
	}

	// Handle number types
	if (schemaType === "number") {
		return { columnType: { kind: "double_precision" }, isEnum: false };
	}

	// Handle boolean
	if (schemaType === "boolean") {
		return { columnType: { kind: "boolean" }, isEnum: false };
	}

	// Handle object
	if (schemaType === "object") {
		// Preserve the original JSON Schema for structure if it has structural fields
		const structuralFields = [
			"properties",
			"required",
			"additionalProperties",
			"patternProperties",
			"minProperties",
			"maxProperties",
			"dependencies",
			"propertyNames",
		];
		const hasStructure = structuralFields.some((field) => field in schema);
		if (hasStructure) {
			return {
				columnType: { kind: "jsonb", schema },
				isEnum: false,
			};
		}
		return { columnType: { kind: "jsonb" }, isEnum: false };
	}

	// Default fallback
	return { columnType: { kind: "text" }, isEnum: false };
};
