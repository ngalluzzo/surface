import { describe, expect, test } from "bun:test";
import {
	convert,
	convertToIR,
	convertToZod,
	defaultNamingStrategy,
} from "../convert";
import { postgresDialect } from "../dialect/postgres";

describe("convert", () => {
	test("returns error when dialect is not provided", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "User",
			type: "object",
			required: ["id"],
			properties: {
				id: { type: "string", format: "uuid" },
			},
		} as unknown;

		const result = convert(schema);
		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("invalid_schema");
		}
	});

	test("converts simple schema to SQL", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "User",
			type: "object",
			required: ["id", "email"],
			properties: {
				id: { type: "string", format: "uuid" },
				email: { type: "string" },
			},
		} as unknown;

		const result = convert(schema, { dialect: postgresDialect });
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value).toContain('CREATE TABLE "user"');
			expect(result.value).toContain('"id" UUID NOT NULL');
			expect(result.value).toContain('"email" TEXT');
		}
	});

	test("returns error for invalid input", () => {
		const result = convert(null, { dialect: postgresDialect });
		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("invalid_json");
		}
	});

	test("respects custom naming strategy", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "UserProfile",
			type: "object",
			required: ["id"],
			properties: {
				id: { type: "string", format: "uuid" },
			},
		} as unknown;

		const result = convert(schema, {
			dialect: postgresDialect,
			naming: {
				toTableName: (name) => `tbl_${name.toLowerCase()}`,
				toColumnName: (name) => `col_${name.toLowerCase()}`,
				toFkColumnName: (refName) => `fk_${refName.toLowerCase()}_id`,
				toJoinTableName: (a, b) => `join_${a.toLowerCase()}_${b.toLowerCase()}`,
				toConstraintName: (table, kind, cols) =>
					`${table}_${kind}_${cols.join("_")}`,
				toEnumName: (table, prop) => `${table}_${prop}_enum`,
				toIndexName: (table, cols) => `${table}_${cols.join("_")}_idx`,
			},
		});
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value).toContain('CREATE TABLE "tbl_userprofile"');
			expect(result.value).toContain('"col_id"');
		}
	});
});

describe("convertToIR", () => {
	test("converts schema to SchemaIR", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "User",
			type: "object",
			required: ["id"],
			properties: {
				id: { type: "string", format: "uuid" },
			},
		} as unknown;

		const result = convertToIR(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value.name).toBe("User");
			expect(result.value.tables.length).toBeGreaterThan(0);
			const table = result.value.tables[0];
			expect(table?.name).toBe("user");
			if (!table) throw new Error("Expected table to be defined");
			const column = table.columns.find((c) => c.name === "id");
			expect(column).toBeDefined();
			if (column) {
				expect(column.type.kind).toBe("uuid");
			}
		}
	});

	test("converts schema with enums", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "Ticket",
			type: "object",
			required: ["id", "status"],
			properties: {
				id: { type: "string", format: "uuid" },
				status: { type: "string", enum: ["open", "closed"] },
			},
		} as unknown;

		const result = convertToIR(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value.enums.length).toBeGreaterThan(0);
			const enumDef = result.value.enums[0];
			expect(enumDef?.name).toBe("ticket_status");
			expect(enumDef?.values).toEqual(["open", "closed"]);
		}
	});

	test("resolves refs in IR", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "Post",
			type: "object",
			required: ["id", "author"],
			properties: {
				id: { type: "string", format: "uuid" },
				author: { $ref: "#/definitions/Author" },
			},
			definitions: {
				Author: {
					title: "Author",
					type: "object",
					required: ["id"],
					properties: {
						id: { type: "string", format: "uuid" },
					},
				},
			},
		} as unknown;

		const result = convertToIR(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value.tables.length).toBe(2);
			const tableNames = result.value.tables.map((t) => t.name);
			expect(tableNames).toContain("post");
			expect(tableNames).toContain("author");
			const postTable = result.value.tables.find((t) => t.name === "post");
			expect(postTable).toBeDefined();
			const hasFk = postTable?.constraints.some(
				(c) => c.kind === "foreign_key" && c.refTable === "author",
			);
			expect(hasFk).toBe(true);
		}
	});
});

describe("defaultNamingStrategy", () => {
	test("converts PascalCase to snake_case for tables", () => {
		expect(defaultNamingStrategy.toTableName("UserProfile")).toBe(
			"user_profile",
		);
		expect(defaultNamingStrategy.toTableName("APIKey")).toBe("a_p_i_key");
	});

	test("converts PascalCase to snake_case for columns", () => {
		expect(defaultNamingStrategy.toColumnName("firstName")).toBe("first_name");
		expect(defaultNamingStrategy.toColumnName("APIKey")).toBe("a_p_i_key");
	});

	test("generates FK column names", () => {
		expect(defaultNamingStrategy.toFkColumnName("User")).toBe("user_id");
		expect(defaultNamingStrategy.toFkColumnName("Author")).toBe("author_id");
	});

	test("generates join table names", () => {
		expect(defaultNamingStrategy.toJoinTableName("User", "Role")).toBe(
			"user_role",
		);
		expect(defaultNamingStrategy.toJoinTableName("Post", "Tag")).toBe(
			"post_tag",
		);
	});

	test("generates constraint names", () => {
		expect(
			defaultNamingStrategy.toConstraintName("users", "primary_key", ["id"]),
		).toBe("users_pkey");
		expect(
			defaultNamingStrategy.toConstraintName("posts", "foreign_key", [
				"author_id",
			]),
		).toBe("posts_author_id_fkey");
		expect(
			defaultNamingStrategy.toConstraintName("users", "unique", ["email"]),
		).toBe("users_email_key");
		expect(
			defaultNamingStrategy.toConstraintName("users", "check", ["age"]),
		).toBe("users_age_check");
	});

	test("generates enum names", () => {
		expect(defaultNamingStrategy.toEnumName("User", "Status")).toBe(
			"user_status",
		);
		expect(defaultNamingStrategy.toEnumName("Ticket", "Priority")).toBe(
			"ticket_priority",
		);
	});

	test("generates index names", () => {
		expect(defaultNamingStrategy.toIndexName("users", ["email"])).toBe(
			"users_email_idx",
		);
		expect(
			defaultNamingStrategy.toIndexName("posts", ["author_id", "created_at"]),
		).toBe("posts_author_id_created_at_idx");
	});
});

describe("convertToZod", () => {
	test("converts simple schema to Zod", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "User",
			type: "object",
			required: ["id", "email"],
			properties: {
				id: { type: "string", format: "uuid" },
				email: { type: "string" },
			},
		} as unknown;

		const result = convertToZod(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value).toContain('import { z } from "zod"');
			expect(result.value).toContain("z.object({");
			expect(result.value).toContain("id: z.uuid(),");
			expect(result.value).toContain("email: z.string()");
		}
	});

	test("returns error for invalid input", () => {
		const result = convertToZod(null);
		expect(result.kind).toBe("err");
		if (result.kind === "err") {
			expect(result.error.kind).toBe("invalid_json");
		}
	});

	test("converts schema with enums", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "Ticket",
			type: "object",
			required: ["id", "status"],
			properties: {
				id: { type: "string", format: "uuid" },
				status: { type: "string", enum: ["open", "closed", "in_progress"] },
			},
		} as unknown;

		const result = convertToZod(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value).toContain(
				'z.enum(["open", "closed", "in_progress"])',
			);
			const enumIndex = result.value.indexOf("z.enum");
			const objectIndex = result.value.indexOf("z.object");
			expect(enumIndex).toBeLessThan(objectIndex);
		}
	});

	test("converts schema with foreign key references", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "Post",
			type: "object",
			required: ["id", "author"],
			properties: {
				id: { type: "string", format: "uuid" },
				author: { $ref: "#/definitions/Author" },
			},
			definitions: {
				Author: {
					title: "Author",
					type: "object",
					required: ["id"],
					properties: {
						id: { type: "string", format: "uuid" },
						name: { type: "string" },
					},
				},
			},
		} as unknown;

		const result = convertToZod(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value).toContain("// --- Enums ---");
			expect(result.value).toContain("// --- Schemas ---");
			expect(result.value).toContain("export const authorSchema");
			expect(result.value).toContain("export const postSchema");
			expect(result.value).toContain("// FK -> author.id");
		}
	});

	test("converts schema with self-referential foreign key", () => {
		const schema = {
			$schema: "http://json-schema.org/draft-07/schema#",
			title: "User",
			type: "object",
			required: ["id", "manager"],
			properties: {
				id: { type: "string", format: "uuid" },
				name: { type: "string" },
				manager: { $ref: "#" },
			},
		} as unknown;

		const result = convertToZod(schema);
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value).toContain("export const userSchema");
			expect(result.value).toContain("export type User");
		}
	});
});
