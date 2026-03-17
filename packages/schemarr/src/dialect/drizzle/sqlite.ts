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
		case "varchar":
			return `text(${quoted})`;
		case "uuid":
			return `text(${quoted})`;
		case "integer":
			return `integer(${quoted})`;
		case "bigint":
			return `integer(${quoted}, { mode: "number" })`;
		case "double_precision":
			return `real(${quoted})`;
		case "boolean":
			return `integer(${quoted}, { mode: "boolean" })`;
		case "date":
		case "timestamp":
		case "timestamptz":
			return `integer(${quoted}, { mode: "timestamp_ms" })`;
		case "json":
		case "jsonb":
			return `text(${quoted}, { mode: "json" })`;
		case "array":
			return `text(${quoted}, { mode: "json" })`;
		case "enum":
			return `text(${quoted})`;
		case "serial":
			return `integer(${quoted}).primaryKey({ autoIncrement: true })`;
		case "bigserial":
			return `integer(${quoted}).primaryKey({ autoIncrement: true })`;
	}
};

/** SQLite expression that generates a UUID v4 string (8-4-4-4-12) so Zod .uuid() accepts it. */
const SQLITE_UUID_V4_DEFAULT =
	"default(sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`)";

const emitDefault = (col: ColumnIR): string[] => {
	const def = col.default;
	if (!def) return [];
	if (def.kind === "expression") {
		if (def.expression === "uuid_random" || def.expression.includes("uuid")) {
			return [SQLITE_UUID_V4_DEFAULT];
		}
		if (def.expression === "now" || def.expression.includes("now")) return [];
		return [`default(${JSON.stringify(def.expression)})`];
	}
	if (typeof def.value === "string")
		return [`default(${JSON.stringify(def.value)})`];
	return [`default(${String(def.value)})`];
};

const emitColumnImpl = (
	col: ColumnIR,
	enumValues: Map<string, readonly string[]>,
	refTarget?: DrizzleRefTarget,
): string => {
	const dbColName = col.propertyKey ? camelToSnake(col.propertyKey) : col.name;
	let base: string;
	if (col.type.kind === "enum") {
		const values = enumValues.get(col.type.enumName);
		if (values) {
			base = `text(${JSON.stringify(dbColName)}, { enum: ${JSON.stringify([...values])} })`;
		} else {
			base = `text(${JSON.stringify(dbColName)})`;
		}
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
		methods.push(SQLITE_UUID_V4_DEFAULT);
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
		return `export const ${tableId} = sqliteTable(${JSON.stringify(tableName)}, {\n${indent([...columnLines])}\n}, (self) => ({\n${indent(selfLines)}\n}));`;
	}

	return `export const ${tableId} = sqliteTable(${JSON.stringify(tableName)}, {\n${indent(columnLines)}\n});`;
};

/** SQLite has no native enums; we inline enum values in column defs. So emit nothing for enums. */
const emitEnum = (_enumDef: EnumIR): string => "";

/**
 * Build a dialect that has enum values for inlining in column defs.
 * The emitter must pass enum values when calling emitColumn for enum columns - but our interface
 * doesn't support that. So we need to capture enums at dialect build time. So we create the dialect
 * with a SchemaIR or enums map. Actually the plan says emitEnum returns empty for sqlite. So for
 * enum columns we need the values - we get them from the schema when emitting. So the emitter
 * (emitDrizzle) will pass enum values to the dialect. That means we need to extend the interface
 * or have the dialect stateful. Simpler: when emitting, for sqlite we build a Map<enumName, values>
 * from schema.enums and pass it to a dialect method. So the dialect could have emitColumn(col, refTarget, enumValues?: Map). That would require changing the interface. Alternative: the sqlite dialect is created with getDialect(enums: EnumIR[]) and it closes over the enum values. So drizzleSqliteDialect is a function getDrizzleSqliteDialect(schema: SchemaIR) that returns DrizzleDialect. Then the emitter calls getDrizzleSqliteDialect(schema) to get the dialect. So we have two ways: 1) dialect is a function of schema, 2) emitColumn gets optional enumValues. Option 1 is cleaner: the dialect is created per emission with schema context. So we export getDrizzleSqliteDialect(schema: SchemaIR): DrizzleDialect. And we export getDrizzlePgDialect(): DrizzleDialect (no args). Let me update the plan in implementation: for sqlite we need enum values in the dialect. So DrizzleDialect could have an optional getEnumValues?: (enumName: string) => readonly string[] | undefined. The emitter would set this when building the dialect for sqlite. So we have getDrizzleSqliteDialect(enumValues: Map<string, readonly string[]>): DrizzleDialect. So the emitter does: const dialect = getDrizzleSqliteDialect(new Map(schema.enums.map(e => [e.name, e.values]))). Let me implement that.
 */
function getDrizzleSqliteDialectImpl(
	enumValues: Map<string, readonly string[]>,
): DrizzleDialect {
	return {
		name: "drizzle-sqlite",
		toTableId: snakeToCamel,
		toPropertyKey: snakeToCamel,
		getImports: () => [
			{ module: "drizzle-orm", names: ["sql"] },
			{
				module: "drizzle-orm/sqlite-core",
				names: ["integer", "real", "sqliteTable", "text", "unique"],
			},
		],
		mapType: (type, columnName) => mapType(type, columnName),
		emitColumn: (col, refTarget) => emitColumnImpl(col, enumValues, refTarget),
		emitTable,
		emitEnum,
	};
}

/** Create the SQLite Drizzle dialect. Pass enum values so enum columns can be inlined. */
export const getDrizzleSqliteDialect = (
	enumValues: Map<string, readonly string[]>,
): DrizzleDialect => getDrizzleSqliteDialectImpl(enumValues);

/** Default SQLite dialect with no enums (for schemas without enums). */
export const drizzleSqliteDialect: DrizzleDialect = getDrizzleSqliteDialectImpl(
	new Map(),
);
