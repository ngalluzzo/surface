import { describe, expect, test } from "bun:test";
import { type Dependency, topologicalSort } from "../topologicalSort";

describe("topologicalSort", () => {
	describe("simple FK dependencies", () => {
		test("A depends on B → B first, then A", () => {
			const items: Dependency[] = [
				{ name: "A", dependsOn: ["B"] },
				{ name: "B", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(2);
			expect(result[0]?.name).toBe("B");
			expect(result[1]?.name).toBe("A");
		});

		test("table_a depends on table_b → table_b first", () => {
			const items: Dependency[] = [
				{ name: "table_a", dependsOn: ["table_b"] },
				{ name: "table_b", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(2);
			expect(result[0]?.name).toBe("table_b");
			expect(result[1]?.name).toBe("table_a");
		});
	});

	describe("chain dependencies", () => {
		test("A → B → C → C, B, A", () => {
			const items: Dependency[] = [
				{ name: "A", dependsOn: ["B"] },
				{ name: "B", dependsOn: ["C"] },
				{ name: "C", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result[0]?.name).toBe("C");
			expect(result[1]?.name).toBe("B");
			expect(result[2]?.name).toBe("A");
		});

		test("four-level chain D → C → B → A", () => {
			const items: Dependency[] = [
				{ name: "D", dependsOn: ["C"] },
				{ name: "C", dependsOn: ["B"] },
				{ name: "B", dependsOn: ["A"] },
				{ name: "A", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(4);
			expect(result.map((item) => item.name)).toEqual(["A", "B", "C", "D"]);
		});
	});

	describe("multiple dependencies", () => {
		test("A depends on B and C → both before A", () => {
			const items: Dependency[] = [
				{ name: "A", dependsOn: ["B", "C"] },
				{ name: "B", dependsOn: [] },
				{ name: "C", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result[2]?.name).toBe("A");
			const r0 = result[0];
			const r1 = result[1];
			expect(r0).toBeDefined();
			expect(r1).toBeDefined();
			if (r0 === undefined || r1 === undefined) throw new Error("expected");
			expect(["B", "C"]).toContain(r0.name);
			expect(["B", "C"]).toContain(r1.name);
		});

		test("three items with multiple deps", () => {
			const items: Dependency[] = [
				{ name: "posts", dependsOn: ["users", "categories"] },
				{ name: "users", dependsOn: [] },
				{ name: "categories", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result[2]?.name).toBe("posts");
			const r0 = result[0];
			const r1 = result[1];
			expect(r0).toBeDefined();
			expect(r1).toBeDefined();
			if (r0 === undefined || r1 === undefined) throw new Error("expected");
			expect(["users", "categories"]).toContain(r0.name);
			expect(["users", "categories"]).toContain(r1.name);
		});
	});

	describe("no dependencies", () => {
		test("items with no deps preserve order", () => {
			const items: Dependency[] = [
				{ name: "A", dependsOn: [] },
				{ name: "B", dependsOn: [] },
				{ name: "C", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result[0]?.name).toBe("A");
			expect(result[1]?.name).toBe("B");
			expect(result[2]?.name).toBe("C");
		});

		test("single item with no deps", () => {
			const items: Dependency[] = [{ name: "solo", dependsOn: [] }];
			const result = topologicalSort(items);
			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("solo");
		});

		test("empty array returns empty", () => {
			const result = topologicalSort([]);
			expect(result).toHaveLength(0);
		});
	});

	describe("cycle detection", () => {
		test("circular dependency A ↔ B returns as-is", () => {
			const items: Dependency[] = [
				{ name: "A", dependsOn: ["B"] },
				{ name: "B", dependsOn: ["A"] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(2);
			// Order might be A,B or B,A - just verify both present
			expect(result.map((item) => item.name as string).sort()).toEqual([
				"A",
				"B",
			]);
		});

		test("three-way cycle A → B → C → A returns all", () => {
			const items: Dependency[] = [
				{ name: "A", dependsOn: ["B"] },
				{ name: "B", dependsOn: ["C"] },
				{ name: "C", dependsOn: ["A"] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result.map((item) => item.name as string).sort()).toEqual([
				"A",
				"B",
				"C",
			]);
		});

		test("self-reference handled gracefully", () => {
			const items: Dependency[] = [
				{ name: "self_ref", dependsOn: ["self_ref"] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("self_ref");
		});
	});

	describe("enum dependencies", () => {
		test("table depends on enum → enum first", () => {
			const items: Dependency[] = [
				{ name: "table_a", dependsOn: ["enum_status"] },
				{ name: "enum_status", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(2);
			expect(result[0]?.name).toBe("enum_status");
			expect(result[1]?.name).toBe("table_a");
		});

		test("multiple tables depend on same enum", () => {
			const items: Dependency[] = [
				{ name: "posts", dependsOn: ["enum_status"] },
				{ name: "comments", dependsOn: ["enum_status"] },
				{ name: "enum_status", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result[0]?.name).toBe("enum_status");
			const r1 = result[1];
			const r2 = result[2];
			expect(r1).toBeDefined();
			expect(r2).toBeDefined();
			if (r1 === undefined || r2 === undefined) throw new Error("expected");
			expect(["posts", "comments"]).toContain(r1.name);
			expect(["posts", "comments"]).toContain(r2.name);
		});

		test("array of enum depends on enum", () => {
			const items: Dependency[] = [
				{ name: "table_a", dependsOn: ["enum_tags"] },
				{ name: "enum_tags", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(2);
			expect(result[0]?.name).toBe("enum_tags");
			expect(result[1]?.name).toBe("table_a");
		});
	});

	describe("mixed FK and enum dependencies", () => {
		test("table has both FK and enum deps", () => {
			const items: Dependency[] = [
				{ name: "posts", dependsOn: ["users", "enum_status"] },
				{ name: "users", dependsOn: [] },
				{ name: "enum_status", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(3);
			expect(result[2]?.name).toBe("posts");
			// users and enum_status must come first
			const r0 = result[0];
			const r1 = result[1];
			expect(r0).toBeDefined();
			expect(r1).toBeDefined();
			if (r0 === undefined || r1 === undefined) throw new Error("expected");
			expect(["users", "enum_status"]).toContain(r0.name);
			expect(["users", "enum_status"]).toContain(r1.name);
		});

		test("complex multi-level with enums and FKs", () => {
			const items: Dependency[] = [
				{ name: "comments", dependsOn: ["posts", "enum_visibility"] },
				{ name: "posts", dependsOn: ["users", "enum_status"] },
				{ name: "users", dependsOn: [] },
				{ name: "enum_status", dependsOn: [] },
				{ name: "enum_visibility", dependsOn: [] },
			];
			const result = topologicalSort(items);
			expect(result).toHaveLength(5);

			const names = result.map((item) => item.name);

			// comments must come last (after posts and enum_visibility)
			expect(names[4]).toBe("comments");

			// posts must come after users and enum_status
			const postsIndex = names.indexOf("posts");
			const usersIndex = names.indexOf("users");
			const statusIndex = names.indexOf("enum_status");
			expect(postsIndex).toBeGreaterThan(usersIndex);
			expect(postsIndex).toBeGreaterThan(statusIndex);

			// comments must come after posts and enum_visibility
			const commentsIndex = names.indexOf("comments");
			const visibilityIndex = names.indexOf("enum_visibility");
			expect(commentsIndex).toBeGreaterThan(postsIndex);
			expect(commentsIndex).toBeGreaterThan(visibilityIndex);
		});
	});
});
