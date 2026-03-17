import { describe, expect, test } from "bun:test";
import {
	createInMemoryIdempotencyStore,
	executeWithIdempotency,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createMinimalOp } from "../fixtures/operations.js";

const ctx = createMockContext();

describe("executeWithIdempotency", () => {
	test("when no key, behaves like execute", async () => {
		const store = createInMemoryIdempotencyStore();
		const exec = executeWithIdempotency(store, 60_000);
		const op = createMinimalOp();
		const result = await exec(op, { id: "x" }, ctx, "http", undefined);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({ id: "x" });
	});

	test("when key present, caches successful result and returns it on second call", async () => {
		const store = createInMemoryIdempotencyStore();
		const exec = executeWithIdempotency(store, 60_000);
		const op = createMinimalOp();
		const result1 = await exec(op, { id: "a" }, ctx, "http", {
			idempotencyKey: "key-same",
		});
		expect(result1.ok).toBe(true);
		if (!result1.ok) return;
		expect(result1.value).toEqual({ id: "a" });

		// Second call with same key but different body — should return cached (id: "a")
		const result2 = await exec(op, { id: "b" }, ctx, "http", {
			idempotencyKey: "key-same",
		});
		expect(result2.ok).toBe(true);
		if (!result2.ok) return;
		expect(result2.value).toEqual({ id: "a" });
	});

	test("when key present and first run fails, does not cache and second run executes again", async () => {
		const store = createInMemoryIdempotencyStore();
		const exec = executeWithIdempotency(store, 60_000);
		const op = createMinimalOp();
		const result1 = await exec(op, {}, ctx, "http", {
			idempotencyKey: "key-fail",
		});
		expect(result1.ok).toBe(false);

		const result2 = await exec(op, { id: "x" }, ctx, "http", {
			idempotencyKey: "key-fail",
		});
		expect(result2.ok).toBe(true);
		if (!result2.ok) return;
		expect(result2.value).toEqual({ id: "x" });
	});
});
