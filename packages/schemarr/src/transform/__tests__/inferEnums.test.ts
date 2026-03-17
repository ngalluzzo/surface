import { describe, expect, test } from "bun:test";
import { inferEnums } from "../inferEnums";
import { snakeCaseNamingStrategy } from "../namingStrategy";

describe("inferEnums", () => {
	test("should infer enum definition and column type", () => {
		const result = inferEnums(
			{
				propertyName: "status",
				tableName: "tickets",
				values: ["open", "in_progress", "resolved", "closed"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef).toMatchObject({
			name: "tickets_status",
			values: ["open", "in_progress", "resolved", "closed"],
		});

		expect(result.columnType).toEqual({
			kind: "enum",
			enumName: "tickets_status",
		});
	});

	test("should use snake_case for enum name", () => {
		const result = inferEnums(
			{
				propertyName: "priorityLevel",
				tableName: "user_profiles",
				values: ["low", "medium", "high"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.name).toBe("user_profiles_priority_level");
	});

	test("should handle multiple values", () => {
		const result = inferEnums(
			{
				propertyName: "type",
				tableName: "documents",
				values: ["pdf", "doc", "docx", "txt", "rtf", "html"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.values).toHaveLength(6);
		expect(result.enumDef.values).toEqual([
			"pdf",
			"doc",
			"docx",
			"txt",
			"rtf",
			"html",
		]);
	});

	test("should handle empty values array", () => {
		const result = inferEnums(
			{
				propertyName: "status",
				tableName: "tasks",
				values: [],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.values).toEqual([]);
		expect(result.columnType.kind).toBe("enum");
	});

	test("should handle single value", () => {
		const result = inferEnums(
			{
				propertyName: "state",
				tableName: "machines",
				values: ["active"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.values).toEqual(["active"]);
	});

	test("should handle special characters in enum values", () => {
		const result = inferEnums(
			{
				propertyName: "tag",
				tableName: "posts",
				values: ["new-feature", "bug_fix", "v1.0.0", "release"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.values).toEqual([
			"new-feature",
			"bug_fix",
			"v1.0.0",
			"release",
		]);
	});

	test("should preserve original case of enum values", () => {
		const result = inferEnums(
			{
				propertyName: "logLevel",
				tableName: "services",
				values: ["INFO", "WARN", "ERROR", "DEBUG"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.values).toEqual(["INFO", "WARN", "ERROR", "DEBUG"]);
	});

	test("should handle spaces in enum values", () => {
		const result = inferEnums(
			{
				propertyName: "status",
				tableName: "orders",
				values: ["in progress", "completed", "cancelled", "on hold"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.values).toEqual([
			"in progress",
			"completed",
			"cancelled",
			"on hold",
		]);
	});

	test("should generate correct column type", () => {
		const result = inferEnums(
			{
				propertyName: "category",
				tableName: "products",
				values: ["electronics", "clothing", "books"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.columnType).toEqual({
			kind: "enum",
			enumName: "products_category",
		});
	});

	test("should handle uppercase property name", () => {
		const result = inferEnums(
			{
				propertyName: "STATUS",
				tableName: "tickets",
				values: ["open", "closed"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.name).toBe("tickets_status");
	});

	test("should handle mixed case table name", () => {
		const result = inferEnums(
			{
				propertyName: "type",
				tableName: "user_profiles",
				values: ["admin", "user", "guest"],
			},
			snakeCaseNamingStrategy,
		);

		expect(result.enumDef.name).toBe("user_profiles_type");
	});
});
