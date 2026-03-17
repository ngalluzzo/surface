import { describe, expect, test } from "bun:test";
import { createInMemoryIdempotencyStore } from "../../src/idempotency/in-memory.js";

describe("createInMemoryIdempotencyStore", () => {
	test("get returns null when key not set", async () => {
		const store = createInMemoryIdempotencyStore();
		const result = await store.get("op1", "key1");
		expect(result).toBeNull();
	});

	test("set then get returns the result within TTL", async () => {
		const store = createInMemoryIdempotencyStore();
		const value = { ok: true as const, value: 42 };
		await store.set("op1", "key1", value, 60_000);
		const result = await store.get("op1", "key1");
		expect(result).toEqual(value);
	});

	test("get returns null after TTL expires", async () => {
		const store = createInMemoryIdempotencyStore();
		await store.set("op1", "key1", { ok: true, value: 1 }, 10);
		await new Promise((r) => setTimeout(r, 15));
		const result = await store.get("op1", "key1");
		expect(result).toBeNull();
	});

	test("different operation or key are isolated", async () => {
		const store = createInMemoryIdempotencyStore();
		await store.set("op1", "key1", { ok: true, value: 1 }, 60_000);
		await store.set("op1", "key2", { ok: true, value: 2 }, 60_000);
		await store.set(
			"op2",
			"key1",
			{ ok: false, error: { phase: "validation" as const, issues: [] } },
			60_000,
		);
		expect(await store.get("op1", "key1")).toEqual({ ok: true, value: 1 });
		expect(await store.get("op1", "key2")).toEqual({ ok: true, value: 2 });
		expect(await store.get("op2", "key1")).toEqual({
			ok: false,
			error: { phase: "validation", issues: [] },
		});
	});

	test("delete removes entry", async () => {
		const store = createInMemoryIdempotencyStore();
		await store.set("op1", "key1", { ok: true, value: 1 }, 60_000);
		await store.delete?.("op1", "key1");
		expect(await store.get("op1", "key1")).toBeNull();
	});
});
