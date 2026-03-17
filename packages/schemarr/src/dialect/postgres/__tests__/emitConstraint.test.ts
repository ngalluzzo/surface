import { describe, expect, test } from "bun:test";
import {
	buildCheck,
	buildForeignKey,
	buildPrimaryKey,
	buildUnique,
} from "../../../lib/test/helpers/builders";
import type { ConstraintIR } from "../../../lib/types";
import { emitConstraint } from "../emitConstraint";

// Helper to build regex pattern test case to avoid escaping issues
const regexPattern = "order_number ~ '^ORD-[0-9]+$'";

describe("emitConstraint", () => {
	describe("PRIMARY KEY", () => {
		test("simple primary key on id", () => {
			const constraint: ConstraintIR = buildPrimaryKey(["id"], "users_pkey");

			const result = emitConstraint(constraint, "users");
			expect(result).toBe('CONSTRAINT "users_pkey" PRIMARY KEY ("id")');
		});

		test("primary key on different column", () => {
			const constraint: ConstraintIR = buildPrimaryKey(
				["email"],
				"users_email_pkey",
			);

			const result = emitConstraint(constraint, "users");
			expect(result).toBe(
				'CONSTRAINT "users_email_pkey" PRIMARY KEY ("email")',
			);
		});

		test("composite primary key", () => {
			const constraint: ConstraintIR = buildPrimaryKey(
				["course_id", "student_id"],
				"course_student_pkey",
			);

			const result = emitConstraint(constraint, "course_student");
			expect(result).toBe(
				'CONSTRAINT "course_student_pkey" PRIMARY KEY ("course_id", "student_id")',
			);
		});

		test("primary key without name uses default naming", () => {
			const constraint: ConstraintIR = buildPrimaryKey(["id"]);

			const result = emitConstraint(constraint, "users");
			expect(result).toBe('CONSTRAINT "users_pkey" PRIMARY KEY ("id")');
		});
	});

	describe("UNIQUE", () => {
		test("simple unique constraint", () => {
			const constraint: ConstraintIR = buildUnique(
				["email"],
				"users_email_key",
			);

			const result = emitConstraint(constraint, "users");
			expect(result).toBe('CONSTRAINT "users_email_key" UNIQUE ("email")');
		});

		test("unique on multiple columns", () => {
			const constraint: ConstraintIR = buildUnique(
				["first_name", "last_name"],
				"users_name_key",
			);

			const result = emitConstraint(constraint, "users");
			expect(result).toBe(
				'CONSTRAINT "users_name_key" UNIQUE ("first_name", "last_name")',
			);
		});

		test("unique without name uses default naming", () => {
			const constraint: ConstraintIR = buildUnique(["email"]);

			const result = emitConstraint(constraint, "users");
			expect(result).toBe('CONSTRAINT "users_email_key" UNIQUE ("email")');
		});
	});

	describe("FOREIGN KEY", () => {
		test("simple foreign key", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "users_author_id_fkey",
				columns: ["author_id"],
				refTable: "users",
				refColumns: ["id"],
				onDelete: "no_action",
				onUpdate: "no_action",
			});

			const result = emitConstraint(constraint, "posts");
			expect(result).toBe(
				'CONSTRAINT "users_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id")',
			);
		});

		test("foreign key with ON DELETE CASCADE", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "orders_customer_id_fkey",
				columns: ["customer_id"],
				refTable: "customers",
				refColumns: ["id"],
				onDelete: "cascade",
				onUpdate: "no_action",
			});

			const result = emitConstraint(constraint, "orders");
			expect(result).toBe(
				'CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE',
			);
		});

		test("foreign key with ON UPDATE CASCADE", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "posts_user_id_fkey",
				columns: ["user_id"],
				refTable: "users",
				refColumns: ["id"],
				onDelete: "no_action",
				onUpdate: "cascade",
			});

			const result = emitConstraint(constraint, "posts");
			expect(result).toBe(
				'CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE CASCADE',
			);
		});

		test("foreign key with SET NULL", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "comments_post_id_fkey",
				columns: ["post_id"],
				refTable: "posts",
				refColumns: ["id"],
				onDelete: "set_null",
				onUpdate: "no_action",
			});

			const result = emitConstraint(constraint, "comments");
			expect(result).toBe(
				'CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE SET NULL',
			);
		});

		test("foreign key with RESTRICT", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "tickets_category_id_fkey",
				columns: ["category_id"],
				refTable: "categories",
				refColumns: ["id"],
				onDelete: "restrict",
				onUpdate: "no_action",
			});

			const result = emitConstraint(constraint, "tickets");
			expect(result).toBe(
				'CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT',
			);
		});

		test("foreign key with both ON DELETE and ON UPDATE", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "orders_customer_id_fkey",
				columns: ["customer_id"],
				refTable: "customers",
				refColumns: ["id"],
				onDelete: "cascade",
				onUpdate: "cascade",
			});

			const result = emitConstraint(constraint, "orders");
			expect(result).toBe(
				'CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
			);
		});

		test("composite foreign key", () => {
			const constraint: ConstraintIR = buildForeignKey({
				name: "order_items_product_variant_fkey",
				columns: ["product_id", "variant_id"],
				refTable: "product_variants",
				refColumns: ["product_id", "variant_id"],
				onDelete: "no_action",
				onUpdate: "no_action",
			});

			const result = emitConstraint(constraint, "order_items");
			expect(result).toBe(
				'CONSTRAINT "order_items_product_variant_fkey" FOREIGN KEY ("product_id", "variant_id") REFERENCES "product_variants" ("product_id", "variant_id")',
			);
		});

		test("foreign key without name uses default naming", () => {
			const constraint: ConstraintIR = buildForeignKey({
				columns: ["user_id"],
				refTable: "users",
				refColumns: ["id"],
			});

			const result = emitConstraint(constraint, "posts");
			expect(result).toBe(
				'CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id")',
			);
		});
	});

	describe("CHECK", () => {
		test("simple check constraint", () => {
			const constraint: ConstraintIR = buildCheck(
				"age >= 0",
				"users_age_check",
			);

			const result = emitConstraint(constraint, "users");
			expect(result).toBe('CONSTRAINT "users_age_check" CHECK (age >= 0)');
		});

		test("check with range", () => {
			const constraint: ConstraintIR = buildCheck(
				"price >= 0 AND price <= 10000",
				"products_price_check",
			);

			const result = emitConstraint(constraint, "products");
			expect(result).toBe(
				'CONSTRAINT "products_price_check" CHECK (price >= 0 AND price <= 10000)',
			);
		});

		test("check with regex pattern", () => {
			const constraint: ConstraintIR = buildCheck(
				regexPattern,
				"orders_order_number_pattern",
			);

			const result = emitConstraint(constraint, "orders");
			expect(result).toBe(
				`CONSTRAINT "orders_order_number_pattern" CHECK (${regexPattern})`,
			);
		});

		test("check with length constraint", () => {
			const constraint: ConstraintIR = buildCheck(
				'char_length("name") >= 1',
				"products_name_min_length",
			);

			const result = emitConstraint(constraint, "products");
			expect(result).toBe(
				'CONSTRAINT "products_name_min_length" CHECK (char_length("name") >= 1)',
			);
		});

		test("check without name uses default naming", () => {
			const constraint: ConstraintIR = buildCheck("count > 0");

			const result = emitConstraint(constraint, "tickets");
			expect(result).toBe('CONSTRAINT "tickets_count_check" CHECK (count > 0)');
		});
	});

	describe("identifier quoting", () => {
		test("all constraint types quote column and table names", () => {
			const pk: ConstraintIR = buildPrimaryKey(["id"], "table_pkey");
			const fk: ConstraintIR = buildForeignKey({
				columns: ["ref_id"],
				refTable: "other_table",
				refColumns: ["id"],
			});
			const unique: ConstraintIR = buildUnique(["email"], "table_email_key");
			const check: ConstraintIR = buildCheck("value > 0");

			expect(emitConstraint(pk, "table")).toContain('"id"');
			expect(emitConstraint(fk, "table")).toContain('"ref_id"');
			expect(emitConstraint(fk, "table")).toContain('"other_table"');
			expect(emitConstraint(unique, "table")).toContain('"email"');
			expect(emitConstraint(check, "table")).toContain("CHECK (value > 0)");
		});
	});
});
