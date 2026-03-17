import { describe, expect, test } from "bun:test";
import {
	buildCheck,
	buildColumn,
	buildForeignKey,
	buildPkColumn,
	buildTable,
	buildUnique,
	colType,
} from "../../../lib/test/helpers/builders";
import { emitZodObject } from "../emitObject";

describe("emitZodObject", () => {
	test("minimal table: single id column", () => {
		const table = buildTable({
			name: "users",
			columns: [buildPkColumn()],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  id: z.uuid(),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("multiple columns: id + email + name", () => {
		const table = buildTable({
			name: "users",
			columns: [
				buildPkColumn(),
				buildColumn({
					name: "email",
					type: colType.varchar(255),
					nullable: true,
				}),
				buildColumn({ name: "name", type: colType.text(), nullable: true }),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255).nullable().optional(),
  name: z.string().nullable().optional(),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("table with single-column unique: email (emit inline // unique comment)", () => {
		const table = buildTable({
			name: "users",
			columns: [
				buildPkColumn(),
				buildColumn({
					name: "email",
					type: colType.varchar(255),
					nullable: false,
				}),
			],
			constraints: [buildUnique(["email"])],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255), // unique
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("table with composite unique: course_id + student_id (emit above z.object({)", () => {
		const table = buildTable({
			name: "course_student",
			columns: [
				buildColumn({
					name: "course_id",
					type: colType.uuid(),
					nullable: false,
				}),
				buildColumn({
					name: "student_id",
					type: colType.uuid(),
					nullable: false,
				}),
				buildColumn({
					name: "enrolled_at",
					type: colType.timestamptz(),
					nullable: false,
				}),
			],
			constraints: [buildUnique(["course_id", "student_id"])],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`// unique: [course_id, student_id]
export const courseStudentSchema = z.object({
  course_id: z.uuid(),
  student_id: z.uuid(),
  enrolled_at: z.iso.datetime(),
});
export type CourseStudent = z.infer<typeof courseStudentSchema>;`,
		);
	});

	test("table with FK column: posts with author_id (FK comment)", () => {
		const table = buildTable({
			name: "posts",
			columns: [
				buildPkColumn(),
				buildColumn({ name: "title", type: colType.text(), nullable: false }),
				buildColumn({ name: "body", type: colType.text(), nullable: true }),
				buildColumn({
					name: "author_id",
					type: colType.uuid(),
					nullable: false,
				}),
			],
			constraints: [
				buildForeignKey({
					columns: ["author_id"],
					refTable: "users",
					refColumns: ["id"],
				}),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const postsSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string().nullable().optional(),
  author_id: z.uuid(), // FK -> users.id
});
export type Posts = z.infer<typeof postsSchema>;`,
		);
	});

	test("table with self-referential FK: user with manager_id -> user.id (FK comment, no special handling)", () => {
		const table = buildTable({
			name: "users",
			columns: [
				buildPkColumn(),
				buildColumn({
					name: "email",
					type: colType.varchar(255),
					nullable: false,
				}),
				buildColumn({
					name: "manager_id",
					type: colType.uuid(),
					nullable: true,
				}),
			],
			constraints: [
				buildForeignKey({
					columns: ["manager_id"],
					refTable: "users",
					refColumns: ["id"],
				}),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255),
  manager_id: z.uuid().nullable().optional(), // FK -> users.id
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("table with CHECK constraints: product with price >= 0", () => {
		const table = buildTable({
			name: "products",
			columns: [
				buildPkColumn(),
				buildColumn({ name: "name", type: colType.text(), nullable: false }),
				buildColumn({
					name: "price",
					type: colType.doublePrecision(),
					nullable: false,
				}),
			],
			constraints: [buildCheck("price >= 0")],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const productsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price: z.number().min(0),
});
export type Products = z.infer<typeof productsSchema>;`,
		);
	});

	test("table with unsupported CHECK: compound expression (emit as comment)", () => {
		const table = buildTable({
			name: "products",
			columns: [
				buildPkColumn(),
				buildColumn({ name: "name", type: colType.text(), nullable: false }),
				buildColumn({
					name: "price",
					type: colType.doublePrecision(),
					nullable: false,
				}),
			],
			constraints: [buildCheck("price >= 0 AND price <= 100")],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const productsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  price: z.number(), // CHECK: price >= 0 AND price <= 100
});
export type Products = z.infer<typeof productsSchema>;`,
		);
	});

	test("table with nullable/required mix", () => {
		const table = buildTable({
			name: "users",
			columns: [
				buildPkColumn(),
				buildColumn({
					name: "email",
					type: colType.varchar(255),
					nullable: false,
				}),
				buildColumn({ name: "name", type: colType.text(), nullable: true }),
				buildColumn({ name: "bio", type: colType.text(), nullable: true }),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255),
  name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("table with defaults", () => {
		const table = buildTable({
			name: "users",
			columns: [
				buildPkColumn(),
				buildColumn({
					name: "email",
					type: colType.varchar(255),
					nullable: false,
				}),
				buildColumn({
					name: "role",
					type: colType.text(),
					nullable: false,
					default: { kind: "literal", value: "user" },
				}),
				buildColumn({
					name: "active",
					type: colType.boolean(),
					nullable: false,
					default: { kind: "literal", value: true },
				}),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255),
  role: z.string().default("user"),
  active: z.boolean().default(true),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("table with enum column referencing external enum", () => {
		const table = buildTable({
			name: "orders",
			columns: [
				buildPkColumn(),
				buildColumn({
					name: "status",
					type: colType.enumRef("order_status"),
					nullable: false,
				}),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const ordersSchema = z.object({
  id: z.uuid(),
  status: orderStatusSchema,
});
export type Orders = z.infer<typeof ordersSchema>;`,
		);
	});

	test("join table (course_student): composite fields, all non-nullable", () => {
		const table = buildTable({
			name: "course_student",
			columns: [
				buildColumn({
					name: "course_id",
					type: colType.uuid(),
					nullable: false,
				}),
				buildColumn({
					name: "student_id",
					type: colType.uuid(),
					nullable: false,
				}),
				buildColumn({
					name: "enrolled_at",
					type: colType.timestamptz(),
					nullable: false,
				}),
			],
			constraints: [buildUnique(["course_id", "student_id"])],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`// unique: [course_id, student_id]
export const courseStudentSchema = z.object({
  course_id: z.uuid(),
  student_id: z.uuid(),
  enrolled_at: z.iso.datetime(),
});
export type CourseStudent = z.infer<typeof courseStudentSchema>;`,
		);
	});

	test("table with column comment: emit above field", () => {
		const table = buildTable({
			name: "users",
			columns: [
				buildPkColumn({ comment: "Primary key" }),
				buildColumn({
					name: "email",
					type: colType.varchar(255),
					nullable: false,
					comment: "User email address",
				}),
				buildColumn({ name: "name", type: colType.text(), nullable: true }),
			],
		});
		const result = emitZodObject(table);
		expect(result).toBe(
			`export const usersSchema = z.object({
  // Primary key
  id: z.uuid(),
  // User email address
  email: z.string().max(255),
  name: z.string().nullable().optional(),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});
});
