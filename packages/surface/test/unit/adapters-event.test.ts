import { describe, expect, test } from "bun:test";
import {
	buildEventMapFromRegistry,
	type DefaultContext,
	type OperationRegistry,
	registerEventConsumers,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createMockEventTransport } from "../fixtures/mock-event-transport.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";

describe("registerEventConsumers", () => {
	test("registers one consumer per event-exposed operation", () => {
		const registry = createRegistryWithMinimalOp();
		const { transport, registered } = createMockEventTransport();
		const ctx = createMockContext();

		registerEventConsumers(registry, transport, ctx);

		expect(registered).toHaveLength(1);
		const def = registered[0];
		expect(def).toBeDefined();
		expect(def?.name).toBe("test.echo");
		expect(def?.topic).toBe("test.echo");
		expect(def?.source).toBe("test");
		expect(typeof def?.parsePayload).toBe("function");
		expect(typeof def?.handler).toBe("function");
	});

	test("registered handler runs parsePayload then execute and does not throw on success", async () => {
		const registry = createRegistryWithMinimalOp();
		const { transport, registered } = createMockEventTransport();
		const ctx = createMockContext();
		registerEventConsumers(registry, transport, ctx);

		const def = registered[0];
		await def?.handler({ id: "payload-1" });
		// No throw
	});

	test("registered handler throws NonRetryableError on validation failure", async () => {
		const registry = createRegistryWithMinimalOp();
		const { transport, registered } = createMockEventTransport();
		const ctx = createMockContext();
		registerEventConsumers(registry, transport, ctx);

		const def = registered[0];
		const { NonRetryableError } = await import("../../src/index.js");
		await expect(def?.handler({ wrong: "shape" })).rejects.toThrow(
			NonRetryableError,
		);
	});

	test("registered handler throws NonRetryableError on guard failure", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { assertAlwaysFail } = await import("../fixtures/guards.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.guardedEvent",
			schema: z.object({ x: z.number() }),
			outputSchema: z.null(),
			guards: [assertAlwaysFail],
			handler: async () => ({ ok: true, value: null }),
			expose: {
				event: {
					source: "test",
					topic: "test.guardedEvent",
					parsePayload: (raw: unknown) => raw,
				},
			},
		});
		const registry = new Map([
			["test.guardedEvent", op],
		]) as OperationRegistry<DefaultContext>;
		const { transport, registered } = createMockEventTransport();
		const ctx = createMockContext();
		registerEventConsumers(registry, transport, ctx);

		const def = registered[0];
		expect(def).toBeDefined();
		const { NonRetryableError } = await import("../../src/index.js");
		await expect(def?.handler({ x: 1 })).rejects.toThrow(NonRetryableError);
	});

	test("registered handler throws retriable Error on handler failure", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.failingEvent",
			schema: z.object({ id: z.string() }),
			outputSchema: z.null(),
			handler: async () => ({ ok: false, error: "handler_error" }),
			expose: {
				event: {
					source: "test",
					topic: "test.failingEvent",
					parsePayload: (raw: unknown) => raw,
				},
			},
		});
		const registry = new Map([
			["test.failingEvent", op],
		]) as OperationRegistry<DefaultContext>;
		const { transport, registered } = createMockEventTransport();
		const ctx = createMockContext();
		registerEventConsumers(registry, transport, ctx);

		const def = registered[0];
		expect(def).toBeDefined();
		await expect(def?.handler({ id: "x" })).rejects.toThrow("Handler failed");
		await expect(def?.handler({ id: "x" })).rejects.not.toThrow(
			(await import("../../src/index.js")).NonRetryableError,
		);
	});
});

describe("buildEventMapFromRegistry", () => {
	test("returns topic and source for each event-exposed operation", () => {
		const registry = createRegistryWithMinimalOp();
		const map = buildEventMapFromRegistry(registry);
		expect(map["test.echo"]).toEqual({ topic: "test.echo", source: "test" });
	});
});
