import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	buildJobBindingsFromRegistry,
	defineOperation,
	defineRegistry,
	registerJobOperations,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createMockJobRunner } from "../fixtures/mock-runner.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";

describe("registerJobOperations", () => {
	test("registers one JobDefinition per job-exposed operation", () => {
		const registry = createRegistryWithMinimalOp();
		const { runner, registered } = createMockJobRunner();
		const ctx = createMockContext();

		registerJobOperations(registry, runner, ctx);

		expect(registered).toHaveLength(1);
		const def = registered[0];
		expect(def).toBeDefined();
		expect(def?.name).toBe("test.echo");
		expect(def?.schema).toBeDefined();
		expect(typeof def?.handler).toBe("function");
		expect(def?.options).toEqual({
			retries: 1,
			timeout: 30_000,
			backoff: "exponential",
		});
	});

	test("registered handler runs execute and does not throw on success", async () => {
		const registry = createRegistryWithMinimalOp();
		const { runner, registered } = createMockJobRunner();
		const ctx = createMockContext();
		registerJobOperations(registry, runner, ctx);

		const def = registered[0];
		await def?.handler({ id: "payload-1" }, {});
		// No throw
	});

	test("registered handler throws NonRetryableError on guard failure", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { assertAlwaysFail } = await import("../fixtures/guards.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.guardedJob",
			schema: z.object({ x: z.number() }),
			outputSchema: z.null(),
			guards: [assertAlwaysFail],
			handler: async () => ({ ok: true, value: null }),
			expose: { job: { default: { queue: "q", retries: 2 } } },
		});
		const registry = defineRegistry("test", [op]);
		const { runner, registered } = createMockJobRunner();
		const ctx = createMockContext();
		registerJobOperations(registry, runner, ctx);

		const def = registered[0];
		expect(def).toBeDefined();
		const { NonRetryableError } = await import("../../src/index.js");
		await expect(def?.handler({ x: 1 }, {})).rejects.toThrow(NonRetryableError);
	});

	test("definition includes idempotencyKey when job config has it", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.idemJob",
			schema: z.object({ personId: z.string(), eventId: z.string() }),
			outputSchema: z.null(),
			handler: async () => ({ ok: true, value: null }),
			expose: {
				job: {
					default: {
						queue: "default",
						idempotencyKey: (p) => `reg:${p.personId}:${p.eventId}`,
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const { runner, registered } = createMockJobRunner();
		const ctx = createMockContext();
		registerJobOperations(registry, runner, ctx);

		expect(registered).toHaveLength(1);
		expect(registered[0]?.idempotencyKey).toBeDefined();
		expect(typeof registered[0]?.idempotencyKey).toBe("function");
		const key = (
			registered[0]?.idempotencyKey as (p: unknown, ctx?: unknown) => string
		)({ personId: "p1", eventId: "e1" }, ctx);
		expect(key).toBe("reg:p1:e1");
	});

	test("standard job binding builder skips stream jobs", () => {
		const op = defineOperation({
			name: "test.streamJobBinding",
			schema: z.object({ id: z.string() }),
			outputSchema: z.never(),
			outputChunkSchema: z.object({ value: z.string() }),
			handler: async () => ({
				ok: true as const,
				value: {
					async *[Symbol.asyncIterator]() {
						yield { value: "chunk" };
					},
				},
			}),
			expose: { job: { default: { queue: "q", retries: 1 } } },
		});
		const registry = defineRegistry("test", [op]);

		expect(buildJobBindingsFromRegistry(registry)).toEqual({});
	});
});
