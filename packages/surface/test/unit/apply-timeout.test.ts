import { describe, expect, test } from "bun:test";
import { applyTimeout } from "../../src/execution/apply-timeout.js";

const ctx = { db: {} };

describe("applyTimeout", () => {
	test("no timeout and no signal returns ctx unchanged and null controller", () => {
		const { contextToUse, controller, timeoutMs } = applyTimeout(
			ctx,
			undefined,
			undefined,
		);
		expect(contextToUse).toBe(ctx);
		expect(controller).toBeNull();
		expect(timeoutMs).toBe(0);
	});

	test("timeout > 0 creates controller and puts its signal on context", () => {
		const config = { timeout: 100 };
		const { contextToUse, controller, timeoutMs } = applyTimeout(
			ctx,
			config,
			undefined,
		);
		expect(timeoutMs).toBe(100);
		expect(controller).not.toBeNull();
		expect((contextToUse as { signal?: AbortSignal }).signal).toBe(
			controller?.signal,
		);
	});

	test("external signal only (no timeout) puts signal on context", () => {
		const ac = new AbortController();
		const { contextToUse, controller, timeoutMs } = applyTimeout(
			ctx,
			undefined,
			ac.signal,
		);
		expect(timeoutMs).toBe(0);
		expect(controller).toBeNull();
		expect((contextToUse as { signal?: AbortSignal }).signal).toBe(ac.signal);
	});

	test("timeout and external signal: controller created, external abort aborts controller", async () => {
		const config = { timeout: 500 };
		const ac = new AbortController();
		const { contextToUse, controller, timeoutMs } = applyTimeout(
			ctx,
			config,
			ac.signal,
		);
		expect(timeoutMs).toBe(500);
		expect(controller).not.toBeNull();
		expect((contextToUse as { signal?: AbortSignal }).signal).toBe(
			controller?.signal,
		);
		ac.abort();
		await new Promise((r) => setTimeout(r, 0));
		expect(controller?.signal.aborted).toBe(true);
	});

	test("timeout 0 or negative yields timeoutMs 0", () => {
		expect(applyTimeout(ctx, { timeout: 0 }, undefined).timeoutMs).toBe(0);
		expect(applyTimeout(ctx, { timeout: -1 }, undefined).timeoutMs).toBe(0);
	});
});
