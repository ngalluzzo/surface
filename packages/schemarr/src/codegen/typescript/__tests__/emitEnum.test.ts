import { describe, expect, test } from "bun:test";
import type { EnumIR } from "../../../lib/types";
import { emitTsEnum } from "../emitEnum";

describe("TypeScript enum emission", () => {
	test("emits simple enum as literal union", () => {
		const enumDef: EnumIR = {
			name: "UserRole",
			values: ["admin", "user", "guest"],
		};

		const result = emitTsEnum(enumDef);

		expect(result).toContain("export type UserRole");
		expect(result).toContain("'admin' | 'user' | 'guest'");
	});

	test("emits enum with single value", () => {
		const enumDef: EnumIR = {
			name: "Status",
			values: ["active"],
		};

		const result = emitTsEnum(enumDef);

		expect(result).toContain("export type Status");
		expect(result).toContain("'active'");
	});

	test("emits enum with many values", () => {
		const enumDef: EnumIR = {
			name: "Priority",
			values: ["low", "medium", "high", "critical"],
		};

		const result = emitTsEnum(enumDef);

		expect(result).toContain("export type Priority");
		expect(result).toContain("'low' | 'medium' | 'high' | 'critical'");
	});
});
