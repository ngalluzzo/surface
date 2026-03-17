import type { ColumnType } from "../../lib/types";

export const mapTypeToTs = (columnType: ColumnType): string => {
	switch (columnType.kind) {
		case "text":
			return "string";

		case "varchar":
			return "string";

		case "uuid":
			return "string";

		case "integer":
		case "bigint":
		case "serial":
		case "bigserial":
			return "number";

		case "double_precision":
			return "number";

		case "boolean":
			return "boolean";

		case "date":
			return "string";

		case "timestamp":
		case "timestamptz":
			return "string";

		case "json":
		case "jsonb":
			return "unknown";

		case "array":
			return `Array<${mapTypeToTs(columnType.inner)}>`;

		case "enum":
			return columnType.enumName;
	}
};
