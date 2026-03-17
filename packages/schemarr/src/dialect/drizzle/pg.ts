import {
	camelToSnake,
	chainCall,
	indent,
	snakeToCamel,
} from "../../codegen/ts-utils";
import type {
	ColumnIR,
	ColumnType,
	ConstraintIR,
	EnumIR,
} from "../../lib/types";
import type { DrizzleDialect, DrizzleRefTarget } from "./types";

const mapType = (type: ColumnType, columnName: string): string => {
	const quoted = JSON.stringify(columnName);
	switch (type.kind) {
		case "text":
			return `text(${quoted})`;
		case "varchar":
			return `varchar(${quoted}, { length: ${type.maxLength} })`;
		case "uuid":
			return `uuid(${quoted})`;
		case "integer":
			return `integer(${quoted})`;
		case "bigint":
			return `bigint(${quoted}, { mode: "number" })`;
		case "double_precision":
			return `doublePrecision(${quoted})`;
		case "boolean":
			return `boolean(${quoted})`;
		case "date":
			return `date(${quoted})`;
		case "timestamp":
		case "timestamptz":
			return `timestamp(${quoted}, { withTimezone: true })`;
		case "json":
		case "jsonb":
			return `json(${quoted})`;
		case "array":
			return `json(${quoted})`;
		case "enum":
			return `/* enum ${type.enumName} */ text(${quoted})`;
		case "serial":
			return `serial(${quoted})`;
		case "bigserial":
			return `bigserial(${quoted}, { mode: "number" })`;
	}
};

const emitDefault = (col: ColumnIR): string[] => {
	const def = col.default;
	if (!def) return [];
	if (def.kind === "expression") {
		if (def.expression === "uuid_random" || def.expression.includes("uuid"))
			return [];
		if (def.expression === "now" || def.expression.includes("now")) return [];
		return [`default(${JSON.stringify(def.expression)})`];
	}
	if (typeof def.value === "string")
		return [`default(${JSON.stringify(def.value)})`];
	return [`default(${String(def.value)})`];
};

const enumExportName = (name: string): string => `${snakeToCamel(name)}Enum`;

const emitColumnImpl = (
	col: ColumnIR,
	refTarget?: DrizzleRefTarget,
): string => {
	const dbColName = col.propertyKey ? camelToSnake(col.propertyKey) : col.name;
	let base: string;
	if (col.type.kind === "enum") {
		base = `${enumExportName(col.type.enumName)}(${JSON.stringify(dbColName)})`;
	} else {
		base = mapType(col.type, dbColName);
	}

	const methods: string[] = [];
	if (
		col.isPrimaryKey &&
		col.type.kind !== "serial" &&
		col.type.kind !== "bigserial"
	) {
		methods.push("primaryKey()");
	}
	if (!col.nullable) {
		methods.push("notNull()");
	}
	if (
		col.type.kind === "uuid" &&
		col.default?.kind === "expression" &&
		col.default.expression === "uuid_random"
	) {
		methods.push("defaultRandom()");
	} else if (
		(col.type.kind === "timestamp" || col.type.kind === "timestamptz") &&
		col.default?.kind === "expression" &&
		col.default.expression === "now"
	) {
		methods.push("defaultNow()");
	} else {
		methods.push(...emitDefault(col));
	}
	if (refTarget) {
		methods.push(
			`references(() => ${refTarget.tableId}.${refTarget.columnKey})`,
		);
	}

	return chainCall(base, methods);
};

const emitColumn = (col: ColumnIR, refTarget?: DrizzleRefTarget): string =>
	emitColumnImpl(col, refTarget);

const emitTable = (
	tableName: string,
	tableId: string,
	columnEntries: ReadonlyArray<[string, string]>,
	constraints: readonly ConstraintIR[],
): string => {
	const uniqueConstraints = constraints.filter(
		(c): c is Extract<typeof c, { kind: "unique" }> =>
			c.kind === "unique" && c.columns.length > 1,
	);
	const columnLines = columnEntries.map(([k, v]) => `${k}: ${v},`);

	if (uniqueConstraints.length > 0) {
		const selfLines = uniqueConstraints.map((c, i) => {
			const cols = c.columns
				.map((colName: string) => `self.${snakeToCamel(colName)}`)
				.join(", ");
			return `constraint_${i}: unique().on(${cols}),`;
		});
		return `export const ${tableId} = pgTable(${JSON.stringify(tableName)}, {\n${indent([...columnLines])}\n}, (self) => ({\n${indent(selfLines)}\n}));`;
	}

	return `export const ${tableId} = pgTable(${JSON.stringify(tableName)}, {\n${indent(columnLines)}\n});`;
};

const emitEnum = (enumDef: EnumIR): string => {
	const id = `${snakeToCamel(enumDef.name)}Enum`;
	const values = JSON.stringify([...enumDef.values]);
	return `export const ${id} = pgEnum(${JSON.stringify(enumDef.name)}, ${values});`;
};

export const drizzlePgDialect: DrizzleDialect = {
	name: "drizzle-pg",
	toTableId: snakeToCamel,
	toPropertyKey: snakeToCamel,
	getImports: () => [
		{
			module: "drizzle-orm/pg-core",
			names: [
				"integer",
				"pgEnum",
				"pgTable",
				"serial",
				"text",
				"timestamp",
				"unique",
				"uuid",
				"varchar",
				"boolean",
				"date",
				"json",
				"bigint",
				"bigserial",
				"doublePrecision",
			],
		},
	],
	mapType,
	emitColumn,
	emitTable,
	emitEnum,
	enumExportName,
};
