import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import type { ResolvedObjectDef, ResolvedSchemaIR } from "../../parser/types";
import { inferRelations } from "../inferRelations";
import type { InferredRelation } from "../types";

describe("inferRelations", () => {
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

	describe("single reference (one-to-many)", () => {
		test("single ref property creates one_to_many relation", () => {
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

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Author",
				buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("username", { type: "string" }),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]).toEqual({
				kind: "one_to_many",
				sourceTable: "Post",
				sourceProperty: "author",
				targetDef: "Author",
				isRequired: true,
			} satisfies InferredRelation);
		});

		test("optional single ref relation", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"reviewer",
					{ $ref: "#/definitions/Author" } as JSONSchema7,
					false,
					"Author",
				),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Author",
				buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]?.isRequired).toBe(false);
		});
	});

	describe("array reference (one-to-many)", () => {
		test("array of refs creates one_to_many relation", () => {
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

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Lesson",
				buildResolvedDef("Lesson", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty("title", { type: "string" }),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]).toEqual({
				kind: "one_to_many",
				sourceTable: "Course",
				sourceProperty: "lessons",
				targetDef: "Lesson",
				isRequired: true,
			});
		});

		test("optional array ref relation", () => {
			const root = buildResolvedDef("Course", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"lessons",
					{
						type: "array",
						items: { $ref: "#/definitions/Lesson" },
					} as JSONSchema7,
					false,
					"Lesson",
				),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Lesson",
				buildResolvedDef("Lesson", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]?.isRequired).toBe(false);
		});
	});

	describe("many-to-many relations", () => {
		test('explicit x-relation: "many-to-many" creates many_to_many', () => {
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

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Student",
				buildResolvedDef("Student", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]).toEqual({
				kind: "many_to_many",
				sourceTable: "Course",
				sourceProperty: "students",
				targetDef: "Student",
				isRequired: true,
			});
		});

		test("array ref appearing in multiple parents creates many_to_many", () => {
			const root = buildResolvedDef("Course", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"students",
					{
						type: "array",
						items: { $ref: "#/definitions/Student" },
					} as JSONSchema7,
					true,
					"Student",
				),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Student",
				buildResolvedDef("Student", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			);
			definitions.set(
				"Instructor",
				buildResolvedDef("Instructor", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty(
						"students",
						{
							type: "array",
							items: { $ref: "#/definitions/Student" },
						} as JSONSchema7,
						true,
						"Student",
					),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			// Student appears in arrays from both Course and Instructor → many-to-many
			expect(relations.length).toBeGreaterThan(0);
			const studentRelations = relations.filter(
				(r) => r.targetDef === "Student",
			);
			expect(studentRelations).toHaveLength(2);
			expect(studentRelations.every((r) => r.kind === "many_to_many")).toBe(
				true,
			);
		});
	});

	describe("multiple relations on same table", () => {
		test("multiple refs to same target create multiple relations", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("title", { type: "string" }),
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

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Author",
				buildResolvedDef("Author", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(2);
			expect(relations[0]?.sourceProperty).toBe("author");
			expect(relations[1]?.sourceProperty).toBe("reviewer");
			expect(relations[0]?.isRequired).toBe(true);
			expect(relations[1]?.isRequired).toBe(false);
		});
	});

	describe("self-referencing relations", () => {
		test("self-ref creates relation to same table", () => {
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

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set("Employee", root);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]?.sourceTable).toBe("Employee");
			expect(relations[0]?.targetDef).toBe("Employee");
		});
	});

	describe("circular references", () => {
		test("circular refs A→B and B→A both detected", () => {
			const root = buildResolvedDef("NodeA", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"sibling",
					{ $ref: "#/definitions/NodeB" } as JSONSchema7,
					true,
					"NodeB",
				),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set("NodeA", root);
			definitions.set(
				"NodeB",
				buildResolvedDef("NodeB", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty(
						"back_ref",
						{ $ref: "#/definitions/NodeA" } as JSONSchema7,
						true,
						"NodeA",
					),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(2);
			expect(
				relations.some(
					(r) => r.sourceTable === "NodeA" && r.targetDef === "NodeB",
				),
			).toBe(true);
			expect(
				relations.some(
					(r) => r.sourceTable === "NodeB" && r.targetDef === "NodeA",
				),
			).toBe(true);
		});
	});

	describe("non-ref properties", () => {
		test("scalar properties do not create relations", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("username", { type: "string" }),
				buildResolvedProperty("age", { type: "integer" }),
				buildResolvedProperty("isActive", { type: "boolean" }),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(0);
		});

		test("inline object properties do not create relations", () => {
			const root = buildResolvedDef("User", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty("address", { type: "object" }),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(0);
		});

		test("array of primitives does not create relation", () => {
			const root = buildResolvedDef("Post", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"tags",
					{
						type: "array",
						items: { type: "string" },
					} as JSONSchema7,
					false,
				),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			expect(relations).toHaveLength(0);
		});
	});

	describe("definitions with refs", () => {
		test("refs in definitions are detected", () => {
			const root = buildResolvedDef("Order", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"customer",
					{ $ref: "#/definitions/Customer" } as JSONSchema7,
					true,
					"Customer",
				),
			]);

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Customer",
				buildResolvedDef("Customer", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
					buildResolvedProperty(
						"orders",
						{
							type: "array",
							items: { $ref: "#/definitions/Order" },
						} as JSONSchema7,
						true,
						"Order",
					),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "one_to_many");

			// Order.customer + Customer.orders
			expect(relations.length).toBeGreaterThan(0);
			expect(
				relations.some(
					(r) => r.sourceTable === "Order" && r.targetDef === "Customer",
				),
			).toBe(true);
			expect(
				relations.some(
					(r) => r.sourceTable === "Customer" && r.targetDef === "Order",
				),
			).toBe(true);
		});
	});

	describe("defaultArrayRefRelation option", () => {
		test('defaultArrayRefRelation: "many_to_many" treats all array refs as many-to-many', () => {
			const root = buildResolvedDef("Course", [
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
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

			const definitions = new Map<string, ResolvedObjectDef>();
			definitions.set(
				"Lesson",
				buildResolvedDef("Lesson", [
					buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				]),
			);

			const resolved: ResolvedSchemaIR = { root, definitions };
			const relations = inferRelations(resolved, "many_to_many");

			expect(relations).toHaveLength(1);
			expect(relations[0]?.kind).toBe("many_to_many");
		});
	});
});
