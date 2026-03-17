import { describe, expect, test } from "bun:test";
import {
	buildColumn,
	buildEnum,
	buildPkColumn,
	buildTable,
	colType,
} from "../../../lib/test/helpers/builders";
import { emitZodSchema } from "../emitZodSchema";

describe("emitZodSchema", () => {
	test("minimal schema: single table with id, email, name", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
					name: "users",
					columns: [
						buildPkColumn(),
						buildColumn({
							name: "email",
							type: colType.varchar(255),
							nullable: false,
						}),
						buildColumn({ name: "name", type: colType.text(), nullable: true }),
					],
				}),
			],
			enums: [],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255),
  name: z.string().nullable().optional(),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("schema with enums: Ticket with status, priority, category", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
					name: "tickets",
					columns: [
						buildPkColumn(),
						buildColumn({
							name: "subject",
							type: colType.varchar(300),
							nullable: true,
						}),
						buildColumn({
							name: "status",
							type: colType.enumRef("ticket_status"),
							nullable: false,
						}),
						buildColumn({
							name: "priority",
							type: colType.enumRef("ticket_priority"),
							nullable: false,
						}),
						buildColumn({
							name: "category",
							type: colType.enumRef("ticket_category"),
							nullable: true,
						}),
						buildColumn({
							name: "duplicate_status",
							type: colType.enumRef("ticket_status"),
							nullable: true,
						}),
					],
				}),
			],
			enums: [
				buildEnum({
					name: "ticket_status",
					values: ["open", "in_progress", "resolved", "closed"],
				}),
				buildEnum({
					name: "ticket_priority",
					values: ["low", "medium", "high", "critical"],
				}),
				buildEnum({
					name: "ticket_category",
					values: ["bug", "feature", "support"],
				}),
			],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

export const ticketStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const ticketCategorySchema = z.enum(["bug", "feature", "support"]);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

// --- Schemas ---

export const ticketsSchema = z.object({
  id: z.uuid(),
  subject: z.string().max(300).nullable().optional(),
  status: ticketStatusSchema,
  priority: ticketPrioritySchema,
  category: ticketCategorySchema.nullable().optional(),
  duplicate_status: ticketStatusSchema.nullable().optional(),
});
export type Tickets = z.infer<typeof ticketsSchema>;`,
		);
	});

	test("schema with FK references: Post with author_id (topological sort)", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
					name: "posts",
					columns: [
						buildPkColumn(),
						buildColumn({
							name: "title",
							type: colType.varchar(500),
							nullable: false,
						}),
						buildColumn({ name: "body", type: colType.text(), nullable: true }),
						buildColumn({
							name: "author_id",
							type: colType.uuid(),
							nullable: false,
						}),
						buildColumn({
							name: "reviewer_id",
							type: colType.uuid(),
							nullable: true,
						}),
						buildColumn({
							name: "published_at",
							type: colType.timestamptz(),
							nullable: true,
						}),
					],
					constraints: [
						{
							kind: "foreign_key",
							columns: ["author_id"],
							refTable: "authors",
							refColumns: ["id"],
							onDelete: "restrict",
							onUpdate: "no_action",
						},
						{
							kind: "foreign_key",
							columns: ["reviewer_id"],
							refTable: "authors",
							refColumns: ["id"],
							onDelete: "set_null",
							onUpdate: "no_action",
						},
					],
				}),
				buildTable({
					name: "authors",
					columns: [
						buildPkColumn(),
						buildColumn({
							name: "username",
							type: colType.varchar(100),
							nullable: false,
						}),
						buildColumn({
							name: "email",
							type: colType.varchar(255),
							nullable: true,
						}),
					],
				}),
			],
			enums: [],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const authorsSchema = z.object({
  id: z.uuid(),
  username: z.string().max(100),
  email: z.string().max(255).nullable().optional(),
});
export type Authors = z.infer<typeof authorsSchema>;

export const postsSchema = z.object({
  id: z.uuid(),
  title: z.string().max(500),
  body: z.string().nullable().optional(),
  author_id: z.uuid(), // FK -> authors.id
  reviewer_id: z.uuid().nullable().optional(), // FK -> authors.id
  published_at: z.iso.datetime().nullable().optional(),
});
export type Posts = z.infer<typeof postsSchema>;`,
		);
	});

	test("schema with self-referential FK: user with manager_id", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
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
						{
							kind: "foreign_key",
							columns: ["manager_id"],
							refTable: "users",
							refColumns: ["id"],
							onDelete: "set_null",
							onUpdate: "no_action",
						},
					],
				}),
			],
			enums: [],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const usersSchema = z.object({
  id: z.uuid(),
  email: z.string().max(255),
  manager_id: z.uuid().nullable().optional(), // FK -> users.id
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});

	test("schema with composite unique: course enrollment", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
					name: "courses",
					columns: [
						buildPkColumn(),
						buildColumn({
							name: "title",
							type: colType.varchar(200),
							nullable: false,
						}),
					],
				}),
				buildTable({
					name: "students",
					columns: [
						buildPkColumn(),
						buildColumn({
							name: "name",
							type: colType.varchar(100),
							nullable: false,
						}),
					],
				}),
				buildTable({
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
					constraints: [
						{
							kind: "unique",
							columns: ["course_id", "student_id"],
						},
						{
							kind: "foreign_key",
							columns: ["course_id"],
							refTable: "courses",
							refColumns: ["id"],
							onDelete: "cascade",
							onUpdate: "no_action",
						},
						{
							kind: "foreign_key",
							columns: ["student_id"],
							refTable: "students",
							refColumns: ["id"],
							onDelete: "cascade",
							onUpdate: "no_action",
						},
					],
				}),
			],
			enums: [],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const coursesSchema = z.object({
  id: z.uuid(),
  title: z.string().max(200),
});
export type Courses = z.infer<typeof coursesSchema>;

export const studentsSchema = z.object({
  id: z.uuid(),
  name: z.string().max(100),
});
export type Students = z.infer<typeof studentsSchema>;

// unique: [course_id, student_id]
export const courseStudentSchema = z.object({
  course_id: z.uuid(), // FK -> courses.id
  student_id: z.uuid(), // FK -> students.id
  enrolled_at: z.iso.datetime(),
});
export type CourseStudent = z.infer<typeof courseStudentSchema>;`,
		);
	});

	test("empty schema: no tables, no enums", () => {
		const schema = {
			name: "public",
			tables: [],
			enums: [],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

// --- Schemas ---`,
		);
	});

	test("schema with only enums, no tables", () => {
		const schema = {
			name: "public",
			tables: [],
			enums: [
				buildEnum({
					name: "status",
					values: ["active", "inactive"],
				}),
			],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

export const statusSchema = z.enum(["active", "inactive"]);
export type Status = z.infer<typeof statusSchema>;

// --- Schemas ---`,
		);
	});

	test("schema with only tables, no enums", () => {
		const schema = {
			name: "public",
			tables: [
				buildTable({
					name: "users",
					columns: [buildPkColumn()],
				}),
			],
			enums: [],
		};
		const result = emitZodSchema(schema);
		expect(result).toBe(
			`import { z } from "zod";

// --- Enums ---

// --- Schemas ---

export const usersSchema = z.object({
  id: z.uuid(),
});
export type Users = z.infer<typeof usersSchema>;`,
		);
	});
});
