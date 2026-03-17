import { describe, expect, test } from "bun:test";
import { testOperation } from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import {
	createMinimalOp,
	createOpWithFailingDomainGuard,
} from "../fixtures/operations.js";

const ctx = createMockContext();

describe("testOperation", () => {
	test("valid payload runs validation, domain guards and handler, returns value", async () => {
		const result = await testOperation(createMinimalOp(), { id: "x" }, ctx);
		expect(result.ok).toBe(true);
		if (result.ok === false) return;
		expect((result as { value: unknown }).value).toEqual({ id: "x" });
	});

	test("validation failure returns validation error", async () => {
		const result = await testOperation(createMinimalOp(), {}, ctx);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.phase).toBe("validation");
	});

	test("domain guard failure returns domain-guard error", async () => {
		const result = await testOperation(
			createOpWithFailingDomainGuard(),
			{ id: "x" },
			ctx,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.phase).toBe("domain-guard");
	});

	test("dryRun true skips handler and returns ok with undefined value", async () => {
		let handlerRan = false;
		const op = {
			...createMinimalOp(),
			handler: async (payload: { id: string }) => {
				handlerRan = true;
				return { ok: true as const, value: payload };
			},
		};
		const result = await testOperation(op, { id: "x" }, ctx, {
			dryRun: true,
		});
		expect(result.ok).toBe(true);
		if (result.ok === false) return;
		expect(result.value).toBeUndefined();
		expect(handlerRan).toBe(false);
	});
});
