import { expect, test } from "bun:test";
import { snakeCaseNamingStrategy } from "../namingStrategy";

const naming = snakeCaseNamingStrategy;

test("toTableName: converts camelCase title to snake_case plural", () => {
	expect(naming.toTableName("User")).toBe("users");
	expect(naming.toTableName("UserProfile")).toBe("user_profiles");
	expect(naming.toTableName("Order")).toBe("orders");
	expect(naming.toTableName("Product")).toBe("products");
});

test("toTableName: handles irregular plurals", () => {
	expect(naming.toTableName("Person")).toBe("people");
	expect(naming.toTableName("Company")).toBe("companies");
	expect(naming.toTableName("Status")).toBe("statuses");
	expect(naming.toTableName("Child")).toBe("children");
});

test("toTableName: handles acronyms properly", () => {
	expect(naming.toTableName("APIKey")).toBe("api_keys");
	expect(naming.toTableName("UserID")).toBe("user_ids");
	expect(naming.toTableName("OAuthToken")).toBe("o_auth_tokens");
});

test("toTableName: handles already snake_case titles", () => {
	expect(naming.toTableName("user_profile")).toBe("user_profiles");
	expect(naming.toTableName("api_key")).toBe("api_keys");
});

test("toColumnName: converts camelCase property to snake_case", () => {
	expect(naming.toColumnName("firstName")).toBe("first_name");
	expect(naming.toColumnName("lastName")).toBe("last_name");
	expect(naming.toColumnName("isActive")).toBe("is_active");
	expect(naming.toColumnName("createdAt")).toBe("created_at");
});

test("toColumnName: handles already snake_case properties", () => {
	expect(naming.toColumnName("first_name")).toBe("first_name");
	expect(naming.toColumnName("created_at")).toBe("created_at");
});

test("toColumnName: handles acronyms in properties", () => {
	expect(naming.toColumnName("userID")).toBe("user_id");
	expect(naming.toColumnName("APIKey")).toBe("api_key");
	expect(naming.toColumnName("oAuthToken")).toBe("o_auth_token");
});

test("toEnumName: creates enum name from table and column", () => {
	expect(naming.toEnumName("user", "status")).toBe("user_status");
	expect(naming.toEnumName("order", "payment_method")).toBe(
		"order_payment_method",
	);
	expect(naming.toEnumName("user_profile", "role")).toBe("user_profile_role");
});

test("toConstraintName: creates unique constraint names", () => {
	expect(naming.toConstraintName("user", "unique", ["email"])).toBe(
		"user_email_unique",
	);
	expect(naming.toConstraintName("user", "unique", ["email", "phone"])).toBe(
		"user_email_phone_unique",
	);
});

test("toConstraintName: creates foreign key constraint names", () => {
	expect(naming.toConstraintName("order", "foreign_key", ["user_id"])).toBe(
		"order_user_id_fkey",
	);
	expect(
		naming.toConstraintName("order_item", "foreign_key", ["product_id"]),
	).toBe("order_item_product_id_fkey");
});

test("toConstraintName: creates primary key constraint names", () => {
	expect(naming.toConstraintName("user", "primary_key", ["id"])).toBe(
		"user_pkey",
	);
	expect(naming.toConstraintName("order", "primary_key", ["id"])).toBe(
		"order_pkey",
	);
});

test("toConstraintName: creates check constraint names", () => {
	expect(naming.toConstraintName("product", "check", ["price"])).toBe(
		"product_price_check",
	);
	expect(naming.toConstraintName("user", "check", ["age"])).toBe(
		"user_age_check",
	);
});

test("toFkColumnName: creates foreign key column name from property", () => {
	expect(naming.toFkColumnName("user")).toBe("user_id");
	expect(naming.toFkColumnName("author")).toBe("author_id");
	expect(naming.toFkColumnName("category")).toBe("category_id");
});

test("toFkColumnName: handles already suffixed properties", () => {
	expect(naming.toFkColumnName("userId")).toBe("user_id");
	expect(naming.toFkColumnName("authorId")).toBe("author_id");
});

test("toJoinTableName: creates join table name for many-to-many", () => {
	expect(naming.toJoinTableName("user", "role")).toBe("roles_users");
	expect(naming.toJoinTableName("product", "category")).toBe(
		"categories_products",
	);
	expect(naming.toJoinTableName("order", "product")).toBe("orders_products");
});

test("toJoinTableName: sorts table names alphabetically for consistency", () => {
	expect(naming.toJoinTableName("role", "user")).toBe("roles_users");
	expect(naming.toJoinTableName("category", "product")).toBe(
		"categories_products",
	);
	expect(naming.toJoinTableName("product", "order")).toBe("orders_products");
});

test("toIndexName: creates index names for columns", () => {
	expect(naming.toIndexName("user", ["email"])).toBe("user_email_idx");
	expect(naming.toIndexName("order", ["status", "created_at"])).toBe(
		"order_status_created_at_idx",
	);
});

test("toIndexName: handles composite indexes", () => {
	expect(naming.toIndexName("product", ["name", "price"])).toBe(
		"product_name_price_idx",
	);
	expect(naming.toIndexName("user", ["first_name", "last_name"])).toBe(
		"user_first_name_last_name_idx",
	);
});
