import { describe, expect, test } from "bun:test";
import { toCamelCase, toPascalCase, toSchemaVarName } from "../naming";

describe("naming utilities", () => {
	describe("toSchemaVarName", () => {
		test("single word name", () => {
			const result = toSchemaVarName("user");
			expect(result).toBe("userSchema");
		});

		test("snake_case with two words", () => {
			const result = toSchemaVarName("order_status");
			expect(result).toBe("orderStatusSchema");
		});

		test("snake_case with three words", () => {
			const result = toSchemaVarName("course_student");
			expect(result).toBe("courseStudentSchema");
		});

		test("empty string returns Schema suffix", () => {
			const result = toSchemaVarName("");
			expect(result).toBe("Schema");
		});
	});

	describe("toPascalCase", () => {
		test("snake_case to PascalCase", () => {
			const result = toPascalCase("order_status");
			expect(result).toBe("OrderStatus");
		});

		test("single word capitalized", () => {
			const result = toPascalCase("user");
			expect(result).toBe("User");
		});

		test("empty string returns empty", () => {
			const result = toPascalCase("");
			expect(result).toBe("");
		});
	});

	describe("toCamelCase", () => {
		test("snake_case to camelCase", () => {
			const result = toCamelCase("user_profile");
			expect(result).toBe("userProfile");
		});

		test("idempotent - no change if already camelCase", () => {
			const result = toCamelCase("firstName");
			expect(result).toBe("firstName");
		});

		test("triple underscore", () => {
			const result = toCamelCase("some_long_name");
			expect(result).toBe("someLongName");
		});

		test("empty string returns empty", () => {
			const result = toCamelCase("");
			expect(result).toBe("");
		});
	});
});
