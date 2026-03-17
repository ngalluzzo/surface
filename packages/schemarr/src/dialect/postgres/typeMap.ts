import type { ColumnType } from "../../lib/types";

/**
 * Map a ColumnType IR to PostgreSQL type string.
 */
export const mapType = (type: ColumnType): string => {
	switch (type.kind) {
		case "text":
			return "TEXT";

		case "varchar":
			return `VARCHAR(${String(type.maxLength)})`;

		case "uuid":
			return "UUID";

		case "integer":
			return "INTEGER";

		case "bigint":
			return "BIGINT";

		case "double_precision":
			return "DOUBLE PRECISION";

		case "boolean":
			return "BOOLEAN";

		case "date":
			return "DATE";

		case "timestamp":
			return "TIMESTAMP";

		case "timestamptz":
			return "TIMESTAMPTZ";

		case "json":
			return "JSON";

		case "jsonb":
			return "JSONB";

		case "array":
			return `${mapType(type.inner)}[]`;

		case "enum":
			return type.enumName;

		case "serial":
			return "SERIAL";

		case "bigserial":
			return "BIGSERIAL";
	}
};
