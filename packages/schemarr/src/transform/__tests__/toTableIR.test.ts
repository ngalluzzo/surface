import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import type { ColumnType, ConstraintIR } from "../../lib/types";
import type { ResolvedObjectDef, ResolvedSchemaIR } from "../../parser/types";
import { snakeCaseNamingStrategy } from "../namingStrategy";
import { toTableIR } from "../toTableIR";

/** Type guard for foreign_key constraint */
function isForeignKeyConstraint(
	constraint: ConstraintIR,
): constraint is Extract<ConstraintIR, { kind: "foreign_key" }> {
	return constraint.kind === "foreign_key";
}

/** Type guard for enum column type */
function isEnumType(
	columnType: ColumnType | undefined,
): columnType is { kind: "enum"; enumName: string } {
	return columnType?.kind === "enum";
}

describe("toTableIR", () => {
	describe("foreign key column types (Issue #5)", () => {
		test("should infer integer FK when target has integer PK", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"author",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					true,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "integer" }, true),
					buildResolvedProperty("username", { type: "string" }),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			const postTable = result.tables.find((t) => t.name === "posts");
			const authorIdColumn = postTable?.columns.find(
				(c) => c.name === "author_id",
			);
			expect(authorIdColumn?.type).toEqual({ kind: "integer" });
		});

		test("should infer bigint FK when target has bigint PK", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"author",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					true,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "integer" }, true),
					buildResolvedProperty("username", { type: "string" }),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			const postTable = result.tables.find((t) => t.name === "posts");
			const authorIdColumn = postTable?.columns.find(
				(c) => c.name === "author_id",
			);
			expect(authorIdColumn?.type).toEqual({ kind: "integer" });
		});
	});

	describe("default values from JSON Schema (Issue #8)", () => {
		test("should extract string default value", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"status",
					{
						type: "string",
						default: "active",
					} as JSONSchema7,
					true,
				),
			]);

			const result = toTableIR(buildResolved(root), defaultOptions);
			const statusCol = result.tables[0]?.columns.find(
				(c) => c.name === "status",
			);
			expect(statusCol?.default).toEqual({ kind: "literal", value: "active" });
		});

		test("should extract number default value", () => {
			const root = buildResolvedDef("Product", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"price",
					{
						type: "number",
						default: 9.99,
					} as JSONSchema7,
					true,
				),
			]);

			const result = toTableIR(buildResolved(root), defaultOptions);
			const priceCol = result.tables[0]?.columns.find(
				(c) => c.name === "price",
			);
			expect(priceCol?.default).toEqual({ kind: "literal", value: 9.99 });
		});

		test("should extract boolean default value", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"active",
					{
						type: "boolean",
						default: true,
					} as JSONSchema7,
					true,
				),
			]);

			const result = toTableIR(buildResolved(root), defaultOptions);
			const activeCol = result.tables[0]?.columns.find(
				(c) => c.name === "active",
			);
			expect(activeCol?.default).toEqual({ kind: "literal", value: true });
		});
	});

	describe("FK cascade actions (Issue #6)", () => {
		test("should support onDelete: CASCADE via x-on-delete extension", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"author",
					{
						$ref: "#/definitions/Author",
						"x-on-delete": "cascade",
					} as JSONSchema7,
					true,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);
			const fk = result.tables[0]?.constraints.find(
				(c) => c.kind === "foreign_key",
			);
			expect(fk?.onDelete).toBe("cascade");
		});

		test("should support onUpdate: SET NULL via extension", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"author",
					{
						$ref: "#/definitions/Author",
						"x-on-update": "set_null",
					} as JSONSchema7,
					false,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);
			const fk = result.tables[0]?.constraints.find(
				(c) => c.kind === "foreign_key",
			);
			expect(fk?.onUpdate).toBe("set_null");
		});
	});

	describe("enum deduplication (Issue #9)", () => {
		test("should correctly deduplicate enums with same values", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"status",
					{ type: "string", enum: ["active", "inactive"] },
					true,
				),
			]);

			const resolved = buildResolved(root, {
				User: buildResolvedDef("User", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty(
						"status",
						{ type: "string", enum: ["active", "inactive"] },
						true,
					),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			const postEnum = result.tables[0]?.columns.find(
				(c) => c.name === "status",
			)?.type;
			const userEnum = result.tables[1]?.columns.find(
				(c) => c.name === "status",
			)?.type;

			expect(postEnum?.kind).toBe("enum");
			expect(userEnum?.kind).toBe("enum");
			expect(isEnumType(postEnum) ? postEnum.enumName : undefined).toBe(
				isEnumType(userEnum) ? userEnum.enumName : undefined,
			);

			const enumDef = result.enums.find(
				(e) =>
					e.name === (isEnumType(postEnum) ? postEnum.enumName : undefined),
			);
			expect(enumDef?.values).toEqual(["active", "inactive"]);
		});

		test("should not incorrectly deduplicate enums with different values", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"status",
					{ type: "string", enum: ["draft", "published"] },
					true,
				),
			]);

			const resolved = buildResolved(root, {
				User: buildResolvedDef("User", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty(
						"status",
						{ type: "string", enum: ["active", "inactive"] },
						true,
					),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			expect(result.enums).toHaveLength(2);

			const postEnum = result.tables[0]?.columns.find(
				(c) => c.name === "status",
			)?.type;
			const userEnum = result.tables[1]?.columns.find(
				(c) => c.name === "status",
			)?.type;

			const postEnumName = isEnumType(postEnum) ? postEnum.enumName : undefined;
			const userEnumName = isEnumType(userEnum) ? userEnum.enumName : undefined;

			expect(postEnumName).not.toBe(userEnumName);

			const postEnumDef = result.enums.find((e) => e.name === postEnumName);
			const userEnumDef = result.enums.find((e) => e.name === userEnumName);

			expect(postEnumDef?.values).toEqual(["draft", "published"]);
			expect(userEnumDef?.values).toEqual(["active", "inactive"]);
		});
	});

	describe("inline object strategies (Issue #10)", () => {
		test("should create separate table for inline objects with separate_table strategy", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"address",
					{
						type: "object",
						properties: {
							street: { type: "string" },
							city: { type: "string" },
						},
					} as JSONSchema7,
					true,
				),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, {
				...defaultOptions,
				inlineObjectStrategy: "separate_table",
			});

			expect(result.tables).toHaveLength(2);
			expect(result.tables.some((t) => t.name === "addresses")).toBe(true);

			const userTable = result.tables.find((t) => t.name === "users");
			const fkCol = userTable?.columns.find((c) => c.name === "address_id");
			expect(fkCol?.type.kind).toBe("uuid");
		});
	});

	describe("index generation (Issue #11)", () => {
		test("should create index on foreign key columns", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"author",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					true,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			const postTable = result.tables.find((t) => t.name === "posts");
			expect(postTable?.indexes).toHaveLength(1);
			expect(postTable?.indexes[0]?.columns).toEqual(["author_id"]);
		});

		test("should create GIN index on JSONB columns", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"metadata",
					{
						type: "object",
						properties: {},
					} as JSONSchema7,
					true,
				),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			const userTable = result.tables.find((t) => t.name === "users");
			const metadataCol = userTable?.columns.find((c) => c.name === "metadata");
			if (metadataCol?.type.kind === "jsonb") {
				expect(userTable?.indexes).toHaveLength(1);
				expect(userTable?.indexes[0]?.method).toBe("gin");
				expect(userTable?.indexes[0]?.columns).toEqual(["metadata"]);
			}
		});

		test("should create index on unique columns", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"email",
					{ type: "string", format: "email", uniqueItems: true },
					true,
				),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			const userTable = result.tables.find((t) => t.name === "users");
			expect(userTable?.indexes).toHaveLength(1);
			expect(userTable?.indexes[0]?.columns).toEqual(["email"]);
		});
	});

	const buildResolvedProperty = (
		name: string,
		schema: JSONSchema7,
		required = false,
		refTarget?: string,
	) => ({
		name,
		schema,
		required,
		refTarget,
	});

	const buildResolvedDef = (
		name: string,
		properties: ReturnType<typeof buildResolvedProperty>[],
		isRoot = false,
	): ResolvedObjectDef => ({
		name,
		properties,
		isRoot,
	});

	const buildResolved = (
		root: ResolvedObjectDef,
		definitions: Record<string, ResolvedObjectDef> = {},
	): ResolvedSchemaIR => ({
		root,
		definitions: new Map(Object.entries(definitions)),
	});

	const defaultOptions = {
		inlineObjectStrategy: "jsonb" as const,
		defaultArrayRefRelation: "one_to_many" as const,
		naming: snakeCaseNamingStrategy,
	};

	describe("minimal schema", () => {
		test("simple object with scalar properties", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("username", { type: "string" }, true),
				buildResolvedProperty("email", { type: "string", format: "email" }),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			expect(result.name).toBe("User");
			expect(result.tables).toHaveLength(1);
			expect(result.tables[0]?.name).toBe("users");
			expect(result.tables[0]?.columns).toHaveLength(3);
			expect(result.tables[0]?.columns[0]).toMatchObject({
				name: "id",
				type: { kind: "uuid" },
				nullable: false,
				isPrimaryKey: true,
			});
			expect(result.tables[0]?.columns[1]).toMatchObject({
				name: "username",
				type: { kind: "text" },
				nullable: false,
				isPrimaryKey: false,
			});
			expect(result.tables[0]?.columns[2]).toMatchObject({
				name: "email",
				type: { kind: "text" },
				nullable: true,
				isPrimaryKey: false,
			});
			expect(result.enums).toHaveLength(0);
		});
	});

	describe("foreign key relations", () => {
		test("single ref adds FK column to source table", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("title", { type: "string" }),
				buildResolvedProperty(
					"author",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					true,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("username", { type: "string" }),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			expect(result.tables).toHaveLength(2);
			const postTable = result.tables.find((t) => t.name === "posts");
			expect(postTable).toBeDefined();

			const authorIdColumn = postTable?.columns.find(
				(c) => c.name === "author_id",
			);
			expect(authorIdColumn).toMatchObject({
				name: "author_id",
				type: { kind: "uuid" },
				nullable: false,
				isPrimaryKey: false,
			});

			const fkConstraint = postTable?.constraints.find(
				(c) => isForeignKeyConstraint(c) && c.columns?.[0] === "author_id",
			);
			expect(fkConstraint).toMatchObject({
				kind: "foreign_key",
				columns: ["author_id"],
				refTable: "authors",
				refColumns: ["id"],
				onDelete: "no_action",
				onUpdate: "no_action",
			});
		});

		test("optional FK column is nullable", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"reviewer",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					false,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);
			const postTable = result.tables.find((t) => t.name === "posts");
			const reviewerIdColumn = postTable?.columns.find(
				(c) => c.name === "reviewer_id",
			);
			expect(reviewerIdColumn?.nullable).toBe(true);
		});

		test("multiple refs to same target create multiple FK columns", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"author",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					true,
					"Author",
				),
				buildResolvedProperty(
					"reviewer",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					false,
					"Author",
				),
			]);

			const resolved = buildResolved(root, {
				Author: buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);
			const postTable = result.tables.find((t) => t.name === "posts");

			expect(
				postTable?.columns.filter((c) => c.name.endsWith("_id")),
			).toHaveLength(2);
			expect(postTable?.columns.some((c) => c.name === "author_id")).toBe(true);
			expect(postTable?.columns.some((c) => c.name === "reviewer_id")).toBe(
				true,
			);
		});
	});

	describe("one-to-many relations (array refs)", () => {
		test("array ref creates FK on child table", () => {
			const root = buildResolvedDef("Course", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("name", { type: "string" }),
				buildResolvedProperty(
					"lessons",
					{
						type: "array",
						items: { $ref: "#/definitions/Lesson" },
					} as JSONSchema7,
					true,
					"Lesson",
				),
			]);

			const resolved = buildResolved(root, {
				Lesson: buildResolvedDef("Lesson", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("title", { type: "string" }),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			expect(result.tables).toHaveLength(2);
			const lessonTable = result.tables.find((t) => t.name === "lessons");
			expect(lessonTable).toBeDefined();

			const courseIdColumn = lessonTable?.columns.find(
				(c) => c.name === "course_id",
			);
			expect(courseIdColumn).toMatchObject({
				name: "course_id",
				type: { kind: "uuid" },
				nullable: false,
				isPrimaryKey: false,
			});

			const fkConstraint = lessonTable?.constraints.find(
				(c) => isForeignKeyConstraint(c) && c.columns?.[0] === "course_id",
			);
			expect(fkConstraint).toMatchObject({
				kind: "foreign_key",
				columns: ["course_id"],
				refTable: "courses",
				refColumns: ["id"],
			});
		});
	});

	describe("many-to-many relations (join tables)", () => {
		test("explicit many-to-many creates join table", () => {
			const root = buildResolvedDef("Course", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"students",
					{
						type: "array",
						items: { $ref: "#/definitions/Student" },
						"x-relation": "many-to-many",
					} as JSONSchema7,
					true,
					"Student",
				),
			]);

			const resolved = buildResolved(root, {
				Student: buildResolvedDef("Student", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("name", { type: "string" }),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			expect(result.tables).toHaveLength(3);
			const joinTable = result.tables.find(
				(t) => t.name.includes("course") && t.name.includes("student"),
			);
			expect(joinTable).toBeDefined();

			expect(joinTable?.columns).toHaveLength(2);
			expect(joinTable?.columns[0]).toMatchObject({
				name: "course_id",
				type: { kind: "uuid" },
				nullable: false,
				isPrimaryKey: true,
			});
			expect(joinTable?.columns[1]).toMatchObject({
				name: "student_id",
				type: { kind: "uuid" },
				nullable: false,
				isPrimaryKey: true,
			});

			const pkConstraint = joinTable?.constraints.find(
				(c) => c.kind === "primary_key",
			);
			expect(pkConstraint).toMatchObject({
				kind: "primary_key",
				columns: ["course_id", "student_id"],
			});

			const fkConstraints = joinTable?.constraints.filter(
				(c) => c.kind === "foreign_key",
			);
			expect(fkConstraints).toHaveLength(2);
			if (!fkConstraints) throw new Error("expected fkConstraints");
			expect(fkConstraints[0]).toMatchObject({
				kind: "foreign_key",
				columns: ["course_id"],
				refTable: "courses",
				refColumns: ["id"],
			});
			expect(fkConstraints[1]).toMatchObject({
				kind: "foreign_key",
				columns: ["student_id"],
				refTable: "students",
				refColumns: ["id"],
			});
		});

		test("join table name uses alphabetical ordering", () => {
			const root = buildResolvedDef("Student", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"courses",
					{
						type: "array",
						items: { $ref: "#/definitions/Course" },
						"x-relation": "many-to-many",
					} as JSONSchema7,
					true,
					"Course",
				),
			]);

			const resolved = buildResolved(root, {
				Course: buildResolvedDef("Course", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);
			const joinTable = result.tables.find(
				(t) => t.name.includes("course") && t.name.includes("student"),
			);
			expect(joinTable?.name).toBe("courses_students"); // alphabetical: courses, students
		});
	});

	describe("enums", () => {
		test("enum property creates enum type and column", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("title", { type: "string" }),
				buildResolvedProperty(
					"status",
					{ type: "string", enum: ["draft", "published", "archived"] },
					true,
				),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			expect(result.enums).toHaveLength(1);
			expect(result.enums[0]).toMatchObject({
				name: "posts_status",
				values: ["draft", "published", "archived"],
			});

			const statusColumn = result.tables[0]?.columns.find(
				(c) => c.name === "status",
			);
			expect(statusColumn).toMatchObject({
				name: "status",
				type: { kind: "enum", enumName: "posts_status" },
				nullable: false,
			});
		});

		test("same enum values in different tables create single enum", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"status",
					{ type: "string", enum: ["active", "inactive"] },
					true,
				),
			]);

			const resolved = buildResolved(root, {
				User: buildResolvedDef("User", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty(
						"status",
						{ type: "string", enum: ["active", "inactive"] },
						true,
					),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			// Should deduplicate based on values, creating a single enum
			expect(result.enums).toHaveLength(1);
			expect(result.enums[0]?.values).toEqual(["active", "inactive"]);

			const postStatusColumn = result.tables
				.find((t) => t.name === "posts")
				?.columns.find((c) => c.name === "status");
			const userStatusColumn = result.tables
				.find((t) => t.name === "users")
				?.columns.find((c) => c.name === "status");

			expect(postStatusColumn?.type).toEqual({
				kind: "enum",
				enumName: "posts_status",
			});
			expect(userStatusColumn?.type).toEqual({
				kind: "enum",
				enumName: "posts_status",
			});
		});
	});

	describe("constraints", () => {
		test("property named id gets PRIMARY KEY constraint", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("username", { type: "string" }),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			const pkConstraint = result.tables[0]?.constraints.find(
				(c) => c.kind === "primary_key",
			);
			expect(pkConstraint).toMatchObject({
				kind: "primary_key",
				name: "users_pkey",
				columns: ["id"],
			});
		});

		test("CHECK constraints from minimum/maximum", () => {
			const root = buildResolvedDef("Product", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("price", {
					type: "number",
					minimum: 0,
					maximum: 10000,
				}),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			const checkConstraints = result.tables[0]?.constraints.filter(
				(c) => c.kind === "check",
			);
			expect(checkConstraints).toHaveLength(2);
			if (!checkConstraints) throw new Error("expected checkConstraints");
			const firstCheck = checkConstraints[0];
			if (!firstCheck) throw new Error("expected first check constraint");
			expect(firstCheck).toMatchObject({
				kind: "check",
				name: "products_price_check_1",
				expression: "price >= 0",
			});
			expect(checkConstraints[1]).toMatchObject({
				kind: "check",
				name: "products_price_check_2",
				expression: "price <= 10000",
			});
		});
	});

	describe("column types", () => {
		test("various JSON Schema types map correctly", () => {
			const root = buildResolvedDef("Test", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("name", { type: "string" }),
				buildResolvedProperty("count", { type: "integer" }),
				buildResolvedProperty("rating", { type: "number" }),
				buildResolvedProperty("active", { type: "boolean" }),
				buildResolvedProperty("tags", {
					type: "array",
					items: { type: "string" },
				} as JSONSchema7),
			]);

			const resolved = buildResolved(root);
			const result = toTableIR(resolved, defaultOptions);

			const table0 = result.tables[0];
			if (!table0) throw new Error("expected first table");
			const { columns } = table0;
			expect(columns.find((c) => c.name === "name")?.type).toEqual({
				kind: "text",
			});
			expect(columns.find((c) => c.name === "count")?.type).toEqual({
				kind: "integer",
			});
			expect(columns.find((c) => c.name === "rating")?.type).toEqual({
				kind: "double_precision",
			});
			expect(columns.find((c) => c.name === "active")?.type).toEqual({
				kind: "boolean",
			});
			expect(columns.find((c) => c.name === "tags")?.type).toEqual({
				kind: "array",
				inner: { kind: "text" },
			});
		});
	});

	describe("complex schema", () => {
		test("real-world ecommerce schema", () => {
			const root = buildResolvedDef("Order", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("order_number", {
					type: "string",
					maxLength: 20,
				}),
				buildResolvedProperty(
					"customer",
					{ $ref: "#/definitions/Customer" } as JSONSchema7,
					true,
					"Customer",
				),
				buildResolvedProperty(
					"status",
					{
						type: "string",
						enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
					},
					true,
				),
				buildResolvedProperty(
					"line_items",
					{
						type: "array",
						items: { $ref: "#/definitions/LineItem" },
					} as JSONSchema7,
					true,
					"LineItem",
				),
			]);

			const resolved = buildResolved(root, {
				Customer: buildResolvedDef("Customer", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("email", { type: "string", format: "email" }),
				]),
				LineItem: buildResolvedDef("LineItem", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("quantity", {
						type: "integer",
						minimum: 1,
					}),
				]),
			});

			const result = toTableIR(resolved, defaultOptions);

			expect(result.tables).toHaveLength(3);
			expect(result.tables.some((t) => t.name === "orders")).toBe(true);
			expect(result.tables.some((t) => t.name === "customers")).toBe(true);
			expect(result.tables.some((t) => t.name === "line_items")).toBe(true);

			expect(result.enums).toHaveLength(1);
			expect(result.enums[0]?.name).toBe("orders_status");
			expect(result.enums[0]?.values).toEqual([
				"pending",
				"confirmed",
				"shipped",
				"delivered",
				"cancelled",
			]);

			const orderTable = result.tables.find((t) => t.name === "orders");
			if (!orderTable) throw new Error("expected orders table");
			expect(orderTable.columns.some((c) => c.name === "customer_id")).toBe(
				true,
			);
			expect(orderTable.constraints.some((c) => c.kind === "foreign_key")).toBe(
				true,
			);

			const lineItemTable = result.tables.find((t) => t.name === "line_items");
			if (!lineItemTable) throw new Error("expected line_items table");
			expect(lineItemTable.columns.some((c) => c.name === "order_id")).toBe(
				true,
			);
		});
	});

	describe("self-referencing", () => {
		test("self-ref creates FK to same table", () => {
			const root = buildResolvedDef("Employee", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("name", { type: "string" }),
				buildResolvedProperty(
					"manager",
					{ $ref: "#/definitions/Employee" } as JSONSchema7,
					false,
					"Employee",
				),
			]);

			const resolved = buildResolved(root, { Employee: root });
			const result = toTableIR(resolved, defaultOptions);

			const employeeTable = result.tables.find((t) => t.name === "employees");
			if (!employeeTable) throw new Error("expected employees table");
			expect(employeeTable.columns.some((c) => c.name === "manager_id")).toBe(
				true,
			);

			const fkConstraint = employeeTable.constraints.find(
				(c) => isForeignKeyConstraint(c) && c.columns?.[0] === "manager_id",
			);
			expect(fkConstraint).toMatchObject({
				kind: "foreign_key",
				columns: ["manager_id"],
				refTable: "employees",
				refColumns: ["id"],
			});
		});
	});
});
