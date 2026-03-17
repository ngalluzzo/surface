import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type {
	ColumnIR,
	ColumnType,
	ConstraintIR,
	EnumIR,
	OnAction,
	SchemaIR,
	TableIR,
} from "../lib/types";
import type { ResolvedObjectDef, ResolvedSchemaIR } from "../parser/types";
import { inferConstraints } from "./inferConstraints";
import { inferEnums } from "./inferEnums";
import { inferRelations } from "./inferRelations";
import { inferType } from "./inferTypes";
import type { InferredRelation, TransformOptions } from "./types";

const isJSONSchema7 = (schema: JSONSchema7Definition): schema is JSONSchema7 =>
	typeof schema === "object";

/**
 * Transform a resolved JSON Schema into SchemaIR.
 *
 * Orchestrates all transform functions:
 * - inferTypes: column types
 * - inferConstraints: PK, CHECK, UNIQUE constraints
 * - inferRelations: FK relationships and join tables
 * - inferEnums: enum types
 * - namingStrategy: snake_case conversion
 */
export const toTableIR = (
	resolved: ResolvedSchemaIR,
	options: TransformOptions,
): SchemaIR => {
	const { naming, defaultArrayRefRelation, inlineObjectStrategy } = options;

	// Collect all object definitions (root + definitions)
	const allDefs = new Map<string, ResolvedObjectDef>();
	allDefs.set(resolved.root.name, resolved.root);
	for (const [name, def] of resolved.definitions) {
		allDefs.set(name, def);
	}

	// Infer relations
	const relations = inferRelations(resolved, defaultArrayRefRelation);

	// Build initial tables for each definition
	const tables = new Map<string, TableIR>();
	const enums = new Map<string, EnumIR>();
	const refPositions = new Map<string, Map<string, number>>();

	for (const [defName, def] of allDefs) {
		const tableName = naming.toTableName(defName);
		const columns: ColumnIR[] = [];
		const constraints: ConstraintIR[] = [];
		const defRefPositions = new Map<string, number>();

		// Process each property
		for (let i = 0; i < def.properties.length; i++) {
			const prop = def.properties[i];
			if (!prop) continue;

			const columnName = naming.toColumnName(prop.name);

			// Track ref properties and their positions
			if (prop.refTarget !== undefined) {
				defRefPositions.set(prop.name, i);
				continue;
			}

			// Check for inline objects
			if (!isJSONSchema7(prop.schema)) continue;
			const { schema } = prop;
			const { type } = schema;
			const isInlineObject = type === "object";

			// Handle inline objects based on strategy
			if (isInlineObject && inlineObjectStrategy === "separate_table") {
				// Create separate table for inline object
				const inlineTableName = naming.toTableName(prop.name);

				// Check if table already exists
				if (!tables.has(inlineTableName)) {
					const inlineColumns: ColumnIR[] = [];
					const inlineConstraints: ConstraintIR[] = [];

					// Add foreign key column to parent table
					const fkColumnName = naming.toFkColumnName(prop.name);
					columns.push({
						name: fkColumnName,
						type: { kind: "uuid" },
						nullable: !prop.required,
						isPrimaryKey: false,
					});

					// Add FK constraint
					constraints.push({
						kind: "foreign_key",
						name: naming.toConstraintName(tableName, "foreign_key", [
							fkColumnName,
						]),
						columns: [fkColumnName],
						refTable: inlineTableName,
						refColumns: ["id"],
						onDelete: "no_action",
						onUpdate: "no_action",
					});

					// Process inline object properties
					const inlineProperties: Record<string, JSONSchema7> =
						schema.properties === undefined
							? {}
							: Object.fromEntries(
									Object.entries(schema.properties).map(([k, v]) => [
										k,
										typeof v === "boolean" ? { type: "boolean" } : v,
									]),
								);
					const requiredProperties: string[] = schema.required ?? [];

					for (const [inlinePropName, inlinePropSchema] of Object.entries(
						inlineProperties,
					)) {
						const inlineColumnName = naming.toColumnName(inlinePropName);
						const isRequired = requiredProperties.includes(inlinePropName);

						const inlineTypeResult = inferType(
							inlinePropName,
							inlinePropSchema,
						);

						let inlineColumnType = inlineTypeResult.columnType;

						// Handle enums
						if (inlineTypeResult.isEnum) {
							const enumSchema = inlinePropSchema as { enum?: unknown[] };
							const enumValues = (enumSchema.enum ?? []).filter(
								(v): v is string => typeof v === "string",
							);

							if (enumValues.length > 0) {
								const enumKey = JSON.stringify(enumValues);
								let existingEnum: EnumIR | undefined;

								if (enums.has(enumKey)) {
									existingEnum = enums.get(enumKey);
								} else {
									const enumResult = inferEnums(
										{
											propertyName: inlinePropName,
											tableName: inlineTableName,
											values: enumValues,
										},
										naming,
									);
									enums.set(enumKey, enumResult.enumDef);
									existingEnum = enumResult.enumDef;
								}

								if (!existingEnum) {
									throw new Error(
										"Expected existingEnum to be defined after enum creation",
									);
								}
								inlineColumnType = {
									kind: "enum",
									enumName: existingEnum.name,
								};
							}
						}

						// Infer constraints
						const inlinePropConstraints = inferConstraints({
							propertyName: inlinePropName,
							columnName: inlineColumnName,
							tableName: inlineTableName,
							schema: inlinePropSchema,
							required: isRequired,
							startingCheckCount: 0,
						});

						// Extract default value
						let inlineDefaultValue: ColumnIR["default"];
						if (
							typeof inlinePropSchema !== "boolean" &&
							"default" in inlinePropSchema &&
							inlinePropSchema.default !== undefined
						) {
							const defValue = inlinePropSchema.default;
							if (
								typeof defValue === "string" ||
								typeof defValue === "number" ||
								typeof defValue === "boolean"
							) {
								inlineDefaultValue = { kind: "literal", value: defValue };
							}
						}

						// Create inline column
						const isInlinePrimaryKey = inlinePropName.toLowerCase() === "id";
						inlineColumns.push({
							name: inlineColumnName,
							type: inlineColumnType,
							nullable: !isRequired,
							isPrimaryKey: isInlinePrimaryKey,
							...(inlineDefaultValue !== undefined && {
								default: inlineDefaultValue,
							}),
						});

						inlineConstraints.push(...inlinePropConstraints.constraints);
					}

					// Add id column if not present
					if (!inlineColumns.some((c) => c.isPrimaryKey)) {
						inlineColumns.unshift({
							name: "id",
							type: { kind: "uuid" },
							nullable: false,
							isPrimaryKey: true,
						});
					}

					// Add PK constraint
					if (inlineColumns.some((c) => c.isPrimaryKey)) {
						inlineConstraints.push({
							kind: "primary_key",
							name: naming.toConstraintName(inlineTableName, "primary_key", [
								"id",
							]),
							columns: ["id"],
						});
					}

					tables.set(inlineTableName, {
						name: inlineTableName,
						columns: inlineColumns,
						constraints: inlineConstraints,
						indexes: [],
					});
				}

				continue;
			}

			// Infer column type
			const typeResult = inferType(prop.name, prop.schema);
			let { columnType } = typeResult;

			// Handle enums
			if (typeResult.isEnum) {
				const schema = prop.schema as { enum?: unknown[] };
				const enumValues = (schema.enum ?? []).filter(
					(v): v is string => typeof v === "string",
				);

				if (enumValues.length > 0) {
					// Deduplicate enums by values
					const enumKey = JSON.stringify(enumValues);
					let existingEnum: EnumIR | undefined;

					if (enums.has(enumKey)) {
						existingEnum = enums.get(enumKey);
					} else {
						const enumResult = inferEnums(
							{
								propertyName: prop.name,
								tableName,
								values: enumValues,
							},
							naming,
						);
						enums.set(enumKey, enumResult.enumDef);
						existingEnum = enumResult.enumDef;
					}

					if (!existingEnum) {
						throw new Error(
							"Expected existingEnum to be defined after enum creation",
						);
					}
					columnType = {
						kind: "enum",
						enumName: existingEnum.name,
					};
				}
			}

			// Infer constraints
			let nextCheckCount = 0;
			const { nextCheckCount: newNextCheckCount, ...rest } = inferConstraints({
				propertyName: prop.name,
				columnName,
				tableName,
				schema: prop.schema,
				required: prop.required,
				startingCheckCount: nextCheckCount,
			});
			nextCheckCount = newNextCheckCount;
			const propConstraints = rest;

			// Extract default value
			let defaultValue: ColumnIR["default"];
			if (
				typeof prop.schema !== "boolean" &&
				"default" in prop.schema &&
				prop.schema.default !== undefined
			) {
				const defValue = prop.schema.default;
				if (
					typeof defValue === "string" ||
					typeof defValue === "number" ||
					typeof defValue === "boolean"
				) {
					defaultValue = { kind: "literal", value: defValue };
				}
			}

			// Create column
			const isPrimaryKey = prop.name.toLowerCase() === "id";
			const column: ColumnIR = {
				name: columnName,
				type: columnType,
				nullable: !prop.required,
				isPrimaryKey,
				...(defaultValue !== undefined && { default: defaultValue }),
			};

			columns.push(column);
			constraints.push(...propConstraints.constraints);
		}

		// Add unique constraints from x-unique extension
		if (def.uniqueColumns) {
			for (const uniqueColumn of def.uniqueColumns) {
				const columnName = naming.toColumnName(uniqueColumn);
				if (columns.some((c) => c.name === columnName)) {
					constraints.push({
						kind: "unique",
						name: naming.toConstraintName(tableName, "unique", [columnName]),
						columns: [columnName],
					});
				}
			}
		}

		tables.set(defName, {
			name: tableName,
			columns,
			constraints,
			indexes: [],
		});
		refPositions.set(defName, defRefPositions);
	}

	// Apply relations (add FK columns and join tables)
	// Build a map from table name to table for easier lookup
	const tablesByName = new Map<string, TableIR>();
	for (const [, table] of tables) {
		tablesByName.set(table.name, table);
	}
	applyRelations(
		tables,
		tablesByName,
		relations,
		naming,
		resolved,
		allDefs,
		refPositions,
	);

	// Deduplicate enums by name (multiple tables might use same enum name)
	const deduplicatedEnums = Array.from(enums.values()).filter(
		(enumDef, index, self) =>
			index === self.findIndex((e) => e.name === enumDef.name),
	);

	// Get all table names for FK validation
	const allTableNames = new Set(Array.from(tables.values()).map((t) => t.name));

	// Validate FK references exist
	const validatedTables = new Map<string, TableIR>();
	for (const [name, table] of tables) {
		const validConstraints = table.constraints.filter((c) => {
			if (c.kind === "foreign_key") {
				return allTableNames.has(c.refTable);
			}
			return true;
		});
		validatedTables.set(name, { ...table, constraints: validConstraints });
	}

	// Generate indexes
	const indexedTables = new Map<string, TableIR>();
	for (const [name, table] of validatedTables) {
		const indexes: {
			name?: string;
			columns: readonly string[];
			unique: boolean;
			method: "btree" | "hash" | "gin" | "gist";
		}[] = [];

		// Create indexes for foreign key columns
		for (const constraint of table.constraints) {
			if (constraint.kind === "foreign_key") {
				indexes.push({
					name: naming.toIndexName(table.name, constraint.columns),
					columns: constraint.columns,
					unique: false,
					method: "btree",
				});
			}
		}

		// Create GIN indexes for JSONB columns
		for (const column of table.columns) {
			if (column.type.kind === "jsonb" && !column.isPrimaryKey) {
				indexes.push({
					name: naming.toIndexName(table.name, [column.name]),
					columns: [column.name],
					unique: false,
					method: "gin",
				});
			}
		}

		// Create indexes for unique columns
		for (const constraint of table.constraints) {
			if (constraint.kind === "unique") {
				indexes.push({
					name: naming.toIndexName(table.name, constraint.columns),
					columns: constraint.columns,
					unique: true,
					method: "btree",
				});
			}
		}

		indexedTables.set(name, {
			...table,
			indexes: indexes as readonly (typeof indexes)[0][],
		});
	}

	return {
		name: resolved.root.name,
		tables: Array.from(indexedTables.values()),
		enums: deduplicatedEnums,
	};
};

/**
 * Get the primary key column type from a table.
 */
const getPrimaryKeyType = (
	tablesByName: Map<string, TableIR>,
	tableName: string,
): ColumnType | null => {
	const table = tablesByName.get(tableName);
	if (!table) return null;

	const pkColumn = table.columns.find((c) => c.isPrimaryKey);
	return pkColumn?.type ?? null;
};

/**
 * Apply relations to tables.
 *
 * - one_to_one / one_to_many (single ref): Add FK column to source table
 * - one_to_many (array ref): Add FK column to target (child) table
 * - many_to_many: Create join table with two FKs
 */
const applyRelations = (
	tables: Map<string, TableIR>,
	tablesByName: Map<string, TableIR>,
	relations: InferredRelation[],
	naming: TransformOptions["naming"],
	_resolved: ResolvedSchemaIR,
	allDefs: Map<string, ResolvedObjectDef>,
	refPositions: Map<string, Map<string, number>>,
): void => {
	const processedManyToMany = new Set<string>();

	for (const relation of relations) {
		if (relation.kind === "many_to_many") {
			// Create or get join table
			const sourceTableName = naming.toTableName(relation.sourceTable);
			const targetTableName = naming.toTableName(relation.targetDef);
			const joinTableName = naming.toJoinTableName(
				relation.sourceTable,
				relation.targetDef,
			);

			// Avoid creating duplicate join tables for same pair
			const joinTableKey = [sourceTableName, targetTableName].sort().join("-");
			if (processedManyToMany.has(joinTableKey)) {
				continue;
			}
			processedManyToMany.add(joinTableKey);

			const sourceTable = tables.get(relation.sourceTable);
			const targetTable = tables.get(relation.targetDef);

			if (!sourceTable || !targetTable) continue;

			const sourcePkType = getPrimaryKeyType(
				tablesByName,
				relation.sourceTable,
			) ?? { kind: "uuid" };
			const targetPkType = getPrimaryKeyType(
				tablesByName,
				relation.targetDef,
			) ?? { kind: "uuid" };

			// Get source and target property schemas for extension properties
			const sourceRefProperty = allDefs
				.get(relation.sourceTable)
				?.properties.find((prop) => prop.name === relation.sourceProperty);
			const sourceRefSchema: JSONSchema7 & {
				"x-on-delete"?: OnAction;
				"x-on-update"?: OnAction;
			} =
				sourceRefProperty?.schema !== undefined &&
				isJSONSchema7(sourceRefProperty.schema)
					? sourceRefProperty.schema
					: ({} as JSONSchema7);

			const joinTable: TableIR = {
				name: joinTableName,
				columns: [
					{
						name: naming.toFkColumnName(relation.sourceTable),
						type: sourcePkType,
						nullable: false,
						isPrimaryKey: true,
					},
					{
						name: naming.toFkColumnName(relation.targetDef),
						type: targetPkType,
						nullable: false,
						isPrimaryKey: true,
					},
				],
				constraints: [
					{
						kind: "primary_key",
						name: naming.toConstraintName(joinTableName, "primary_key", [
							naming.toFkColumnName(relation.sourceTable),
							naming.toFkColumnName(relation.targetDef),
						]),
						columns: [
							naming.toFkColumnName(relation.sourceTable),
							naming.toFkColumnName(relation.targetDef),
						],
					},
					{
						kind: "foreign_key",
						name: naming.toConstraintName(joinTableName, "foreign_key", [
							naming.toFkColumnName(relation.sourceTable),
						]),
						columns: [naming.toFkColumnName(relation.sourceTable)],
						refTable: sourceTableName,
						refColumns: ["id"],
						onDelete:
							(sourceRefSchema as { "x-on-delete"?: OnAction } | undefined)?.[
								"x-on-delete"
							] ?? "no_action",
						onUpdate:
							(sourceRefSchema as { "x-on-update"?: OnAction } | undefined)?.[
								"x-on-update"
							] ?? "no_action",
					},
					{
						kind: "foreign_key",
						name: naming.toConstraintName(joinTableName, "foreign_key", [
							naming.toFkColumnName(relation.targetDef),
						]),
						columns: [naming.toFkColumnName(relation.targetDef)],
						refTable: targetTableName,
						refColumns: ["id"],
						onDelete: "no_action",
						onUpdate: "no_action",
					},
				],
				indexes: [],
			};

			tables.set(joinTableName, joinTable);
		} else {
			// one_to_one or one_to_many - need to determine FK placement
			const sourceTable = tables.get(relation.sourceTable);
			const targetTable = tables.get(relation.targetDef);

			if (!sourceTable || !targetTable) continue;

			// Check if this is an array ref by looking at the property schema
			const sourceDef = allDefs.get(relation.sourceTable);
			const sourceProperty = sourceDef?.properties.find(
				(p) => p.name === relation.sourceProperty,
			);
			const isFromArray =
				sourceProperty?.schema !== undefined &&
				isJSONSchema7(sourceProperty.schema) &&
				sourceProperty.schema.type === "array";

			// Get property with the $ref to read extension properties
			const refProperty = sourceDef?.properties.find(
				(p) => p.name === relation.sourceProperty,
			);
			const refSchema: JSONSchema7 & {
				"x-on-delete"?: OnAction;
				"x-on-update"?: OnAction;
			} =
				refProperty?.schema !== undefined && isJSONSchema7(refProperty.schema)
					? refProperty.schema
					: ({} as JSONSchema7);

			// For array refs, FK goes on target (child) table
			// For single refs, FK goes on source table
			const fkTargetTable = isFromArray ? targetTable : sourceTable;
			const fkSourceTableName = isFromArray
				? naming.toTableName(relation.sourceTable)
				: naming.toTableName(relation.targetDef);
			const fkTargetTableName = naming.toTableName(
				isFromArray ? relation.targetDef : relation.sourceTable,
			);

			// Determine FK column name
			const fkColumnName = isFromArray
				? naming.toFkColumnName(relation.sourceTable)
				: naming.toFkColumnName(relation.sourceProperty);

			// Check if FK column already exists
			const fkColumnExists = fkTargetTable.columns.some(
				(c) => c.name === fkColumnName,
			);
			if (fkColumnExists) continue;

			// Get referenced table's PK type
			const referencedPkType = getPrimaryKeyType(
				tablesByName,
				fkSourceTableName,
			) ?? { kind: "uuid" };

			// Add FK column
			const fkColumn: ColumnIR = {
				name: fkColumnName,
				type: referencedPkType,
				nullable: !relation.isRequired,
				isPrimaryKey: false,
			};

			// Add FK constraint
			const fkConstraint: ConstraintIR = {
				kind: "foreign_key",
				name: naming.toConstraintName(fkTargetTableName, "foreign_key", [
					fkColumnName,
				]),
				columns: [fkColumnName],
				refTable: fkSourceTableName,
				refColumns: ["id"],
				onDelete: refSchema["x-on-delete"] ?? "no_action",
				onUpdate: refSchema["x-on-update"] ?? "no_action",
			};

			// Update the appropriate table
			const tableToUpdate = isFromArray
				? relation.targetDef
				: relation.sourceTable;

			// Insert FK column at the position of the ref property
			const defRefPositions = refPositions.get(tableToUpdate);
			const refPos = defRefPositions?.get(relation.sourceProperty);
			let newColumns: ColumnIR[];
			if (refPos !== undefined) {
				// Insert FK column at the position of the ref property
				// Adjust the position since we skipped ref properties when building columns
				const insertAt = refPos;
				newColumns = [
					...fkTargetTable.columns.slice(0, insertAt),
					fkColumn,
					...fkTargetTable.columns.slice(insertAt),
				];
			} else {
				// Fallback to appending at the end
				newColumns = [...fkTargetTable.columns, fkColumn];
			}

			tables.set(tableToUpdate, {
				...fkTargetTable,
				columns: newColumns,
				constraints: [...fkTargetTable.constraints, fkConstraint],
			});
		}
	}
};
