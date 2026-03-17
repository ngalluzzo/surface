import { describe, expect, test } from "bun:test";
import { buildEnum } from "../../../lib/test/helpers/builders";
import { emitEnum } from "../emitEnum";

describe("emitEnum", () => {
	test("simple enum with two values", () => {
		const enumDef = buildEnum({
			name: "order_status",
			values: ["pending", "confirmed"],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe(
			"CREATE TYPE \"order_status\" AS ENUM ('pending', 'confirmed');",
		);
	});

	test("enum with many values", () => {
		const enumDef = buildEnum({
			name: "ticket_priority",
			values: ["low", "medium", "high", "critical"],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe(
			"CREATE TYPE \"ticket_priority\" AS ENUM ('low', 'medium', 'high', 'critical');",
		);
	});

	test("enum with single value", () => {
		const enumDef = buildEnum({
			name: "single_value",
			values: ["only"],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe("CREATE TYPE \"single_value\" AS ENUM ('only');");
	});

	test("enum name with underscores", () => {
		const enumDef = buildEnum({
			name: "user_status_type",
			values: ["active", "inactive"],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe(
			"CREATE TYPE \"user_status_type\" AS ENUM ('active', 'inactive');",
		);
	});

	test("enum with empty values array", () => {
		const enumDef = buildEnum({
			name: "empty_enum",
			values: [],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe('CREATE TYPE "empty_enum" AS ENUM ();');
	});

	test("enum values with special characters", () => {
		const enumDef = buildEnum({
			name: "special_enum",
			values: ["O'Reilly", "O'Brien"],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe(
			"CREATE TYPE \"special_enum\" AS ENUM ('O''Reilly', 'O''Brien');",
		);
	});

	test("enum from real fixture", () => {
		const enumDef = buildEnum({
			name: "order_status",
			values: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
		});

		const result = emitEnum(enumDef);
		expect(result).toBe(
			"CREATE TYPE \"order_status\" AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');",
		);
	});
});
