import { describe, expect, test } from "bun:test";
import { buildEnum } from "../../../lib/test/helpers/builders";
import { emitZodEnum } from "../emitEnum";

describe("emitZodEnum", () => {
	test("simple enum with two values", () => {
		const enumDef = buildEnum({
			name: "order_status",
			values: ["pending", "confirmed"],
		});
		const result = emitZodEnum(enumDef);
		expect(result).toBe(
			`export const orderStatusSchema = z.enum(["pending", "confirmed"]);\nexport type OrderStatus = z.infer<typeof orderStatusSchema>;`,
		);
	});

	test("single value enum", () => {
		const enumDef = buildEnum({
			name: "single",
			values: ["only"],
		});
		const result = emitZodEnum(enumDef);
		expect(result).toBe(
			`export const singleSchema = z.enum(["only"]);\nexport type Single = z.infer<typeof singleSchema>;`,
		);
	});

	test("many values (4+ values)", () => {
		const enumDef = buildEnum({
			name: "status",
			values: [
				"active",
				"inactive",
				"pending",
				"suspended",
				"deleted",
				"archived",
			],
		});
		const result = emitZodEnum(enumDef);
		expect(result).toBe(
			`export const statusSchema = z.enum([
  "active",
  "inactive",
  "pending",
  "suspended",
  "deleted",
  "archived",
]);
export type Status = z.infer<typeof statusSchema>;`,
		);
	});

	test("values with apostrophe (O'Reilly) need no escaping inside double quotes", () => {
		const enumDef = buildEnum({
			name: "name",
			values: ["O'Reilly", "D'Angelo"],
		});
		const result = emitZodEnum(enumDef);
		expect(result).toBe(
			`export const nameSchema = z.enum(["O'Reilly", "D'Angelo"]);\nexport type Name = z.infer<typeof nameSchema>;`,
		);
	});

	test("empty values array", () => {
		const enumDef = buildEnum({
			name: "empty",
			values: [],
		});
		const result = emitZodEnum(enumDef);
		expect(result).toBe(
			`export const emptySchema = z.enum([]);\nexport type Empty = z.infer<typeof emptySchema>;`,
		);
	});
});
