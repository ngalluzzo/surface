import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
	convertZodToIR,
	convertZodToSql,
	convertZodToTypes,
	convertZodToZod,
} from "../convertZod";
import { postgresDialect } from "../dialect/postgres";

describe("convertZodToSql", () => {
	it("should convert a simple z.object schema to SQL", async () => {
		const schema = z.object({
			id: z.uuid(),
			name: z.string(),
			email: z.email(),
		});

		const result = await convertZodToSql(schema, { dialect: postgresDialect });

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const sql = result.value;
			expect(sql).toContain("CREATE TABLE");
			expect(sql).toContain('"id" UUID');
			expect(sql).toContain('"name" TEXT');
			expect(sql).toContain('"email" TEXT');
		}
	});

	it("should handle optional fields", async () => {
		const schema = z.object({
			id: z.uuid(),
			name: z.string(),
			age: z.number().optional(),
		});

		const result = await convertZodToSql(schema, { dialect: postgresDialect });

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const sql = result.value;
			expect(sql).toContain('"age" DOUBLE PRECISION');
		}
	});

	it("should handle nullable fields", async () => {
		const schema = z.object({
			id: z.uuid(),
			name: z.string().nullable(),
		});

		const result = await convertZodToSql(schema, { dialect: postgresDialect });

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const sql = result.value;
			expect(sql).toContain('"name"');
		}
	});

	it("should handle arrays", async () => {
		const schema = z.object({
			id: z.uuid(),
			tags: z.array(z.string()),
		});

		const result = await convertZodToSql(schema, { dialect: postgresDialect });

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const sql = result.value;
			expect(sql).toContain('"tags" TEXT[]');
		}
	});

	it("should require dialect option", async () => {
		const schema = z.object({
			id: z.uuid(),
			name: z.string(),
		});

		const result = await convertZodToSql(schema, {});

		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("invalid_schema");
			if (result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain("Dialect is required");
			}
		}
	});

	it("should pass through x-relation metadata", async () => {
		const schema = z
			.object({
				userId: z.string(),
			})
			.meta({
				"x-relation": "one-to-many",
			});

		const result = await convertZodToSql(schema, { dialect: postgresDialect });

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const sql = result.value;
			expect(sql).toContain("CREATE TABLE");
		}
	});

	it("should handle unrepresentable types with zod.unrepresentable option", async () => {
		const schema = z.object({
			id: z.uuid(),
			counter: z.bigint(),
		});

		const result = await convertZodToSql(schema, {
			dialect: postgresDialect,
			zod: { unrepresentable: "any" },
		});

		expect(result.kind).toBe("ok");
	});

	it("should fail on unrepresentable types with default settings", async () => {
		const schema = z.object({
			id: z.uuid(),
			counter: z.bigint(),
		});

		const result = await convertZodToSql(schema, { dialect: postgresDialect });

		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("unrepresentable_type");
		}
	});

	it("should use custom naming strategy", async () => {
		const schema = z.object({
			userId: z.uuid(),
		});

		const result = await convertZodToSql(schema, {
			dialect: postgresDialect,
			naming: {
				toColumnName: (name) => `col_${name}`,
				toTableName: (name) => name,
			},
		});

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const sql = result.value;
			expect(sql).toContain('"col_userId"');
		}
	});
});

describe("convertZodToTypes", () => {
	it("should convert a z.object schema to TypeScript types", async () => {
		const schema = z.object({
			id: z.string(),
			name: z.string(),
		});

		const result = await convertZodToTypes(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ts = result.value;
			expect(ts).toContain("export type");
			expect(ts).toContain("id: string");
			expect(ts).toContain("name: string");
		}
	});

	it("should handle optional fields", async () => {
		const schema = z.object({
			id: z.string(),
			age: z.number().optional(),
		});

		const result = await convertZodToTypes(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ts = result.value;
			// Zod's .optional() is handled by the existing type generation
			expect(ts).toContain("age");
		}
	});

	it("should handle nullable fields", async () => {
		const schema = z.object({
			id: z.string(),
			name: z.string().nullable(),
		});

		const result = await convertZodToTypes(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ts = result.value;
			expect(ts).toContain("name:");
		}
	});

	it("should handle arrays", async () => {
		const schema = z.object({
			id: z.string(),
			tags: z.array(z.string()),
		});

		const result = await convertZodToTypes(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ts = result.value;
			// Arrays are converted by the existing type generation
			expect(ts).toContain("tags:");
		}
	});
});

describe("convertZodToZod", () => {
	it("should convert a z.object schema to normalized Zod code", async () => {
		const schema = z.object({
			id: z.string(),
			name: z.string(),
		});

		const result = await convertZodToZod(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const zodCode = result.value;
			expect(zodCode).toContain('import { z } from "zod"');
			expect(zodCode).toContain("z.object");
			expect(zodCode).toContain("z.string");
		}
	});

	it("should preserve constraints", async () => {
		const schema = z.object({
			id: z.string(),
			name: z.string().max(100),
			age: z.number().min(0).max(150),
		});

		const result = await convertZodToZod(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const zodCode = result.value;
			expect(zodCode).toContain(".max(100)");
			expect(zodCode).toContain(".min(0)");
			expect(zodCode).toContain(".max(150)");
		}
	});
});

describe("convertZodToIR", () => {
	it("should convert a z.object schema to SchemaIR", async () => {
		const schema = z.object({
			id: z.uuid(),
			name: z.string(),
		});

		const result = await convertZodToIR(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ir = result.value;
			expect(ir).toHaveProperty("tables");
			expect(ir).toHaveProperty("enums");
			expect(ir.tables).toBeInstanceOf(Array);
			expect(ir.tables.length).toBeGreaterThan(0);
		}
	});

	it("should infer table name from schema title", async () => {
		const schema = z
			.object({
				id: z.uuid(),
				name: z.string(),
			})
			.meta({ title: "User" });

		const result = await convertZodToIR(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ir = result.value;
			const table = ir.tables.find((t) => t.name === "user");
			expect(table).toBeDefined();
		}
	});

	it("should extract column types correctly", async () => {
		const schema = z.object({
			id: z.uuid(),
			name: z.string(),
			count: z.number(),
			isActive: z.boolean(),
		});

		const result = await convertZodToIR(schema);

		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			const ir = result.value;
			const table = ir.tables[0];
			expect(table).toBeDefined();
			expect(table?.columns).toBeDefined();

			const idCol = table?.columns.find((c) => c.name === "id");
			expect(idCol).toBeDefined();

			const countCol = table?.columns.find((c) => c.name === "count");
			expect(countCol).toBeDefined();

			// isActive gets converted to is_active by default naming strategy
			const isActiveCol = table?.columns.find((c) => c.name === "is_active");
			expect(isActiveCol).toBeDefined();
		}
	});
});
