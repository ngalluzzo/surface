import { describe, expect, test } from "bun:test";
import { defineRegistry, registerCronOperations } from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createMockCronScheduler } from "../fixtures/mock-cron-scheduler.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";

describe("registerCronOperations", () => {
	test("registers one definition per cron-exposed operation", () => {
		const registry = createRegistryWithMinimalOp();
		const { scheduler, registered } = createMockCronScheduler();
		const ctx = createMockContext();

		registerCronOperations(registry, scheduler, ctx);

		expect(registered).toHaveLength(1);
		const def = registered[0];
		expect(def).toBeDefined();
		expect(def?.name).toBe("test.echo");
		expect(def?.schedule).toBe("0 9 * * 1");
		expect(typeof def?.handler).toBe("function");
	});

	test("when scheduler fires, handler runs buildPayload then execute and does not throw on success", async () => {
		const registry = createRegistryWithMinimalOp();
		const { scheduler, fire } = createMockCronScheduler();
		const ctx = createMockContext();
		registerCronOperations(registry, scheduler, ctx);

		await fire("test.echo");
		// No throw
	});

	/** Returns a payload that fails schema validation; used to test NonRetryableError path. */
	function invalidCronPayloadForTest(): { id: string } {
		// Intentionally wrong shape to trigger validation error
		return { wrong: "shape" } as unknown as { id: string };
	}

	test("registered handler throws NonRetryableError on validation failure", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.cronValidationFail",
			schema: z.object({ id: z.string() }),
			outputSchema: z.null(),
			handler: async () => ({ ok: true, value: null }),
			expose: {
				cron: {
					default: {
						schedule: "* * * * *",
						buildPayload: invalidCronPayloadForTest,
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const { scheduler, fire } = createMockCronScheduler();
		const ctx = createMockContext();
		registerCronOperations(registry, scheduler, ctx);

		const { NonRetryableError } = await import("../../src/index.js");
		await expect(fire("test.cronValidationFail")).rejects.toThrow(
			NonRetryableError,
		);
	});

	test("registered handler throws NonRetryableError on guard failure", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { assertAlwaysFail } = await import("../fixtures/guards.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.cronGuarded",
			schema: z.object({ x: z.number() }),
			outputSchema: z.null(),
			guards: [assertAlwaysFail],
			handler: async () => ({ ok: true, value: null }),
			expose: {
				cron: {
					default: {
						schedule: "* * * * *",
						buildPayload: () => ({ x: 1 }),
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const { scheduler, fire } = createMockCronScheduler();
		const ctx = createMockContext();
		registerCronOperations(registry, scheduler, ctx);

		const { NonRetryableError } = await import("../../src/index.js");
		await expect(fire("test.cronGuarded")).rejects.toThrow(NonRetryableError);
	});

	test("registered handler throws retriable Error on handler failure", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.cronHandlerFail",
			schema: z.object({ id: z.string() }),
			outputSchema: z.null(),
			handler: async () => ({ ok: false, error: "handler_error" }),
			expose: {
				cron: {
					default: {
						schedule: "* * * * *",
						buildPayload: () => ({ id: "x" }),
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const { scheduler, fire } = createMockCronScheduler();
		const ctx = createMockContext();
		registerCronOperations(registry, scheduler, ctx);

		await expect(fire("test.cronHandlerFail")).rejects.toThrow(
			"Handler failed",
		);
	});

	test("buildPayload can return Promise", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.cronAsyncPayload",
			schema: z.object({ id: z.string() }),
			outputSchema: z.null(),
			handler: async () => ({ ok: true, value: null }),
			expose: {
				cron: {
					default: {
						schedule: "* * * * *",
						buildPayload: async () => ({ id: "async-1" }),
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const { scheduler, fire } = createMockCronScheduler();
		const ctx = createMockContext();
		registerCronOperations(registry, scheduler, ctx);

		await fire("test.cronAsyncPayload");
		// No throw
	});
});
