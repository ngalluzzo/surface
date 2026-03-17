import { describe, expect, test } from "bun:test";
import type { JSONSchema7 } from "json-schema";
import type {
	CompositionKind,
	ResolvedObjectDef,
	ResolvedSchemaIR,
} from "../../parser/types";
import { snakeCaseNamingStrategy } from "../namingStrategy";
import { toTableIR } from "../toTableIR";

describe("allOf transformation", () => {
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
		composition?: CompositionKind,
	): ResolvedObjectDef => ({
		name,
		properties,
		isRoot,
		composition,
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

	test("should create single table with merged columns", () => {
		// Simulate an allOf that was already merged at the parser level
		// The root has composition info and merged properties
		const root = buildResolvedDef(
			"User",
			[
				buildResolvedProperty("id", { type: "string", format: "uuid" }, true),
				buildResolvedProperty(
					"createdAt",
					{ type: "string", format: "date-time" },
					true,
				),
				buildResolvedProperty(
					"updatedAt",
					{ type: "string", format: "date-time" },
					true,
				),
				buildResolvedProperty("email", { type: "string" }, true),
			],
			true,
			{
				kind: "allOf",
				sources: ["TimestampedEntity", "_inline_0"],
			},
		);

		const resolved = buildResolved(root);
		const result = toTableIR(resolved, defaultOptions);

		expect(result.tables).toHaveLength(1);
		const userTable = result.tables.find((t) => t.name === "users");
		expect(userTable).toBeDefined();

		expect(userTable?.columns).toHaveLength(4);
		const columnNames = userTable?.columns.map((c) => c.name);
		expect(columnNames).toContain("id");
		expect(columnNames).toContain("created_at");
		expect(columnNames).toContain("updated_at");
		expect(columnNames).toContain("email");
	});
});
