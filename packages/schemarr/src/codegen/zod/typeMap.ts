import type { JSONSchema7 } from "json-schema";
import type { ColumnType } from "../../lib/types";
import { toSchemaVarName } from "./naming";

/**
 * Convert a ColumnType IR to a Zod schema expression string.
 */
export const mapTypeToZod = (columnType: ColumnType): string => {
	switch (columnType.kind) {
		case "text":
			return "z.string()";

		case "varchar":
			return `z.string().max(${String(columnType.maxLength)})`;

		case "uuid":
			return "z.uuid()";

		case "integer":
		case "bigint":
		case "serial":
		case "bigserial":
			return "z.number().int()";

		case "double_precision":
			return "z.number()";

		case "boolean":
			return "z.boolean()";

		case "date":
			return "z.iso.date()";

		case "timestamp":
		case "timestamptz":
			return "z.iso.datetime()";

		case "json":
		case "jsonb":
			if (columnType.schema) {
				return jsonSchemaToZod(columnType.schema);
			}
			return "z.unknown()";

		case "array":
			return `z.array(${mapTypeToZod(columnType.inner)})`;

		case "enum":
			return toSchemaVarName(columnType.enumName);
	}
};

/**
 * Convert a JSON Schema to a Zod schema expression string.
 *
 * This handles the subset of JSON Schema that can appear in json/jsonb columns:
 * - Object types with properties
 * - String types with formats and maxLength
 * - Integer types with format
 * - Number, boolean types
 * - Required fields
 */
const jsonSchemaToZod = (schema: JSONSchema7): string => {
	const schemaType = schema.type;

	if (schemaType === "object" && schema.properties) {
		const props = schema.properties;
		const { required } = schema;

		// If no required array, all fields are required
		// If required array exists, only fields in it are required
		const requiredSet = required ? new Set(required) : new Set<string>();
		const hasRequiredSpecified = required !== undefined && required.length > 0;

		const fieldStrings = Object.entries(props).map(([name, propSchema]) => {
			if (typeof propSchema === "boolean") {
				return `${name}: ${propSchema ? "z.any()" : "z.never()"}`;
			}
			let field = `${name}: ${jsonSchemaToZod(propSchema)}`;

			// Add .optional() for non-required fields (only when required is specified)
			if (hasRequiredSpecified && !requiredSet.has(name)) {
				field += ".optional()";
			}

			return field;
		});

		return `z.object({ ${fieldStrings.join(", ")} })`;
	}

	if (schemaType === "string") {
		if (schema.format === "uuid") {
			return "z.uuid()";
		}
		if (schema.format === "date-time") {
			return "z.iso.datetime()";
		}
		if (schema.format === "date") {
			return "z.iso.date()";
		}
		if (
			schema.maxLength !== undefined &&
			typeof schema.maxLength === "number"
		) {
			return `z.string().max(${String(schema.maxLength)})`;
		}
		return "z.string()";
	}

	if (schemaType === "integer") {
		if (schema.format === "int64") {
			return "z.number().int()";
		}
		return "z.number().int()";
	}

	if (schemaType === "number") {
		return "z.number()";
	}

	if (schemaType === "boolean") {
		return "z.boolean()";
	}

	// Fallback for unsupported types
	return "z.unknown()";
};
