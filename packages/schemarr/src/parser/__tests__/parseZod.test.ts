import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { parseZodSchema } from "../parseZod";

describe("parseZodSchema", () => {
	describe("basic object schemas", () => {
		it("should parse a simple z.object schema", async () => {
			const schema = z.object({
				id: z.string(),
				name: z.string(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const validated = result.value;
				expect(validated.title).toBe("");
				expect(validated.schema).toHaveProperty("type", "object");
				expect(validated.schema.properties).toHaveProperty("id");
				expect(validated.schema.properties).toHaveProperty("name");
			}
		});

		it("should parse a z.object schema with metadata title", async () => {
			const schema = z
				.object({
					id: z.string(),
					name: z.string(),
				})
				.meta({ title: "User" });

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				expect(result.value.title).toBe("User");
			}
		});

		it("should parse a z.object schema with required and optional fields", async () => {
			const schema = z.object({
				id: z.string(),
				email: z.string(),
				age: z.number().optional(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const { schema: jsonSchema } = result.value;
				expect(jsonSchema.required).toEqual(["id", "email"]);
				expect(jsonSchema.properties).toHaveProperty("age");
			}
		});

		it("should handle nullable fields", async () => {
			const schema = z.object({
				name: z.string().nullable(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const nameProp = result.value.schema.properties?.name;
				expect(nameProp).toBeDefined();
				expect(nameProp).toHaveProperty("anyOf");
			}
		});
	});

	describe("string types with formats", () => {
		it("should parse z.uuid() as string with uuid format", async () => {
			const schema = z.object({
				id: z.uuid(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const idProp = result.value.schema.properties?.id;
				expect(idProp).toHaveProperty("type", "string");
				expect(idProp).toHaveProperty("format", "uuid");
			}
		});

		it("should parse z.email() as string with email format", async () => {
			const schema = z.object({
				email: z.email(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const emailProp = result.value.schema.properties?.email;
				expect(emailProp).toHaveProperty("type", "string");
				expect(emailProp).toHaveProperty("format", "email");
			}
		});

		it("should parse z.iso.datetime() as string with date-time format", async () => {
			const schema = z.object({
				createdAt: z.iso.datetime(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.createdAt;
				expect(prop).toHaveProperty("type", "string");
				expect(prop).toHaveProperty("format", "date-time");
			}
		});

		it("should handle string with maxLength", async () => {
			const schema = z.object({
				name: z.string().max(100),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.name;
				expect(prop).toHaveProperty("maxLength", 100);
			}
		});
	});

	describe("numeric types", () => {
		it("should parse z.number() correctly", async () => {
			const schema = z.object({
				price: z.number(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.price;
				expect(prop).toHaveProperty("type", "number");
			}
		});

		it("should parse z.int() as integer", async () => {
			const schema = z.object({
				count: z.int(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.count;
				expect(prop).toHaveProperty("type", "integer");
			}
		});

		it("should handle numeric constraints", async () => {
			const schema = z.object({
				age: z.number().min(0).max(150),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.age;
				expect(prop).toHaveProperty("minimum", 0);
				expect(prop).toHaveProperty("maximum", 150);
			}
		});
	});

	describe("boolean type", () => {
		it("should parse z.boolean() correctly", async () => {
			const schema = z.object({
				isActive: z.boolean(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.isActive;
				expect(prop).toHaveProperty("type", "boolean");
			}
		});
	});

	describe("array types", () => {
		it("should parse z.array() correctly", async () => {
			const schema = z.object({
				tags: z.array(z.string()),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.tags as
					| Record<string, { type?: string; items?: { type?: string } }>
					| undefined;
				expect(prop).toBeDefined();
				expect(prop).toHaveProperty("type", "array");
				expect(prop?.items).toHaveProperty("type", "string");
			}
		});
	});

	describe("enums", () => {
		it("should parse z.enum() correctly", async () => {
			const schema = z.object({
				status: z.enum(["active", "inactive", "pending"]),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.status;
				expect(prop).toHaveProperty("type", "string");
				expect(prop).toHaveProperty("enum", ["active", "inactive", "pending"]);
			}
		});
	});

	describe("custom registry", () => {
		it("should use metadata from provided registry", async () => {
			const registry = z.registry<{ title: string; description: string }>();

			const idSchema = z.string().register(registry, {
				title: "ID",
				description: "User ID",
			});

			const schema = z.object({
				id: idSchema,
			});

			const result = await parseZodSchema(schema, { metadata: registry });

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const idProp = result.value.schema.properties?.id;
				expect(idProp).toHaveProperty("title", "ID");
				expect(idProp).toHaveProperty("description", "User ID");
			}
		});

		it("should extract schemas with IDs into definitions when using registry", async () => {
			const registry = z.registry<{ id?: string }>();

			const idSchema = z.uuid().register(registry, { id: "uuid" });
			const userSchema = z.object({
				id: idSchema,
				name: idSchema,
			});

			const result = await parseZodSchema(userSchema, {
				metadata: registry,
				reused: "ref",
			});

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const { schema: jsonSchema } = result.value;
				expect(jsonSchema).toHaveProperty("definitions");
				expect(jsonSchema.definitions).toHaveProperty("uuid");
			}
		});
	});

	describe("unrepresentable types", () => {
		it('should handle z.bigint() with unrepresentable: "any"', async () => {
			const schema = z.object({
				counter: z.bigint(),
			});

			const result = await parseZodSchema(schema, { unrepresentable: "any" });

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.counter;
				expect(prop).toBeDefined();
			}
		});

		it('should handle z.date() with unrepresentable: "any"', async () => {
			const schema = z.object({
				createdAt: z.date(),
			});

			const result = await parseZodSchema(schema, { unrepresentable: "any" });

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const prop = result.value.schema.properties?.createdAt;
				expect(prop).toBeDefined();
			}
		});

		it('should fail on unrepresentable types with unrepresentable: "throw"', async () => {
			const schema = z.object({
				counter: z.bigint(),
			});

			const result = await parseZodSchema(schema, { unrepresentable: "throw" });

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("unrepresentable_type");
			}
		});

		it('should fail on void types with unrepresentable: "throw"', async () => {
			const schema = z.object({
				data: z.void(),
			});

			const result = await parseZodSchema(schema, { unrepresentable: "throw" });

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("unrepresentable_type");
			}
		});

		it('should fail on function types with unrepresentable: "throw"', async () => {
			const schema = z.object({
				callback: z.function(),
			});

			const result = await parseZodSchema(schema, { unrepresentable: "throw" });

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("unrepresentable_type");
			}
		});

		it("should fail on undefined types", async () => {
			const schema = z.object({
				data: z.undefined(),
			});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("unrepresentable_type");
			}
		});

		it("should handle invalid non-Zod schema inputs", async () => {
			const result = await parseZodSchema(null as unknown);

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("invalid_schema");
			}
		});

		it("should handle plain object inputs", async () => {
			const result = await parseZodSchema({ type: "object" } as unknown);

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("invalid_schema");
			}
		});

		it("should handle number inputs", async () => {
			const result = await parseZodSchema(123 as unknown);

			expect(result.kind).toBe("err");
			if (result.kind === "err") {
				expect(result.error.kind).toBe("invalid_schema");
			}
		});
	});

	describe("extension properties for SQL hints", () => {
		it("should pass through x-relation metadata", async () => {
			const schema = z
				.object({
					userId: z.string(),
				})
				.meta({
					"x-relation": "one-to-many",
				});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const { schema: jsonSchema } = result.value;
				expect(jsonSchema).toHaveProperty("x-relation", "one-to-many");
			}
		});

		it("should pass through x-on-delete and x-on-update metadata", async () => {
			const schema = z
				.object({
					userId: z.string(),
				})
				.meta({
					"x-on-delete": "CASCADE",
					"x-on-update": "CASCADE",
				});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const { schema: jsonSchema } = result.value;
				expect(jsonSchema).toHaveProperty("x-on-delete", "CASCADE");
				expect(jsonSchema).toHaveProperty("x-on-update", "CASCADE");
			}
		});

		it("should pass through x-unique metadata", async () => {
			const schema = z
				.object({
					slug: z.string(),
				})
				.meta({
					"x-unique": ["slug"],
				});

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const { schema: jsonSchema } = result.value;
				expect(jsonSchema).toHaveProperty("x-unique", ["slug"]);
			}
		});
	});

	describe("zod registry to JSON Schema", () => {
		it("should convert a zod registry to multiple schemas", async () => {
			const User = z
				.object({
					id: z.string(),
					name: z.string(),
				})
				.meta({ title: "User" });

			const Post = z
				.object({
					id: z.string(),
					title: z.string(),
				})
				.meta({ title: "Post" });

			z.globalRegistry.add(User, { id: "User" });
			z.globalRegistry.add(Post, { id: "Post" });

			const result = await parseZodSchema(z.globalRegistry);

			// Clean up
			z.globalRegistry.clear();

			expect(result.kind).toBe("ok");
			if (result.kind === "ok") {
				const { schema: jsonSchema } = result.value;
				expect(jsonSchema).toHaveProperty("schemas");
				const schemas = (jsonSchema as { schemas: Record<string, unknown> })
					.schemas;
				expect(schemas).toHaveProperty("User");
				expect(schemas).toHaveProperty("Post");
			}
		});

		it("should return error for empty registry", async () => {
			z.globalRegistry.clear();

			const result = await parseZodSchema(z.globalRegistry);

			expect(result.kind).toBe("err");
			if (result.kind === "err" && result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain("Registry contains no schemas");
			}
		});
	});

	describe("invalid root schema types", () => {
		it("should return error for string root schema", async () => {
			const schema = z.string();

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("err");
			if (result.kind === "err" && result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain(
					'Root schema must have type "object"',
				);
			}
		});

		it("should return error for number root schema", async () => {
			const schema = z.number();

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("err");
			if (result.kind === "err" && result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain(
					'Root schema must have type "object"',
				);
			}
		});

		it("should return error for array root schema", async () => {
			const schema = z.array(z.string());

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("err");
			if (result.kind === "err" && result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain(
					'Root schema must have type "object"',
				);
			}
		});

		it("should return error for boolean root schema", async () => {
			const schema = z.boolean();

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("err");
			if (result.kind === "err" && result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain(
					'Root schema must have type "object"',
				);
			}
		});

		it("should return error for null root schema", async () => {
			const schema = z.null();

			const result = await parseZodSchema(schema);

			expect(result.kind).toBe("err");
			if (result.kind === "err" && result.error.kind === "invalid_schema") {
				expect(result.error.message).toContain(
					'Root schema must have type "object"',
				);
			}
		});
	});
});
