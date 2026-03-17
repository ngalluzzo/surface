import { describe, expect, test } from "bun:test";
import type { AnyOperation, DefaultContext } from "../../src/index.js";
import {
	buildHttpHandlers,
	buildHttpMapFromRegistry,
	composeRegistries,
	createInMemoryIdempotencyStore,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import {
	createDefinedRegistry,
	createMinimalOp,
	createRegistryWithMinimalOp,
} from "../fixtures/operations.js";

const ctx = createMockContext();

describe("buildHttpHandlers", () => {
	test("builds route key as METHOD path and handler calls execute with req.body", async () => {
		const registry = createRegistryWithMinimalOp();
		const handlers = buildHttpHandlers(registry, ctx);
		expect(handlers.size).toBe(1);
		const route = "POST /test/echo";
		expect(handlers.has(route)).toBe(true);

		const handler = handlers.get(route);
		if (!handler) throw new Error(`Expected handler for ${route}`);
		const res = await handler(
			{
				method: "POST",
				path: "/test/echo",
				body: { id: "req-1" },
				headers: {},
			},
			ctx,
		);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ id: "req-1" });
	});

	test("validation failure returns 400 and error body", async () => {
		const registry = createRegistryWithMinimalOp();
		const handlers = buildHttpHandlers(registry, ctx);
		const handler = handlers.get("POST /test/echo");
		if (!handler) throw new Error("Expected handler for POST /test/echo");
		const res = await handler(
			{ method: "POST", path: "/test/echo", body: {}, headers: {} },
			ctx,
		);
		expect(res.status).toBe(400);
		expect(res.body).toBeDefined();
		expect((res.body as { phase: string }).phase).toBe("validation");
	});

	test("registry composed with hooks: handlers invoke hooks during execute", async () => {
		const starts: string[] = [];
		const registry = composeRegistries([createDefinedRegistry()], {
			hooks: {
				onPhaseStart: (meta) => {
					starts.push(`${meta.operation.name}:${meta.phase}`);
				},
			},
		});
		const handlers = buildHttpHandlers(registry, ctx);
		const handler = handlers.get("POST /test/twoGuards");
		if (!handler) throw new Error("Expected handler for POST /test/twoGuards");
		const res = await handler(
			{
				method: "POST",
				path: "/test/twoGuards",
				body: { id: "y" },
				headers: {},
			},
			ctx,
		);
		expect(res.status).toBe(200);
		expect(starts.length).toBeGreaterThan(0);
		expect(starts).toContain("test.twoGuards:surface-guard");
		expect(starts).toContain("test.twoGuards:validation");
		expect(starts).toContain("test.twoGuards:domain-guard");
		expect(starts).toContain("test.twoGuards:handler");
	});

	test("timeout returns 504 and error body with phase timeout", async () => {
		const slowOp = {
			...createMinimalOp(),
			name: "test.slow",
			expose: {
				...createMinimalOp().expose,
				http: {
					method: "POST" as const,
					path: "/test/slow",
					timeout: 50,
				},
			},
			handler: async (payload: { id: string }) => {
				await new Promise((r) => setTimeout(r, 200));
				return { ok: true as const, value: payload };
			},
		};
		const registry = new Map<string, AnyOperation<DefaultContext>>();
		registry.set(slowOp.name, slowOp as AnyOperation<DefaultContext>);
		const handlers = buildHttpHandlers(registry, ctx);
		const handler = handlers.get("POST /test/slow");
		if (!handler) throw new Error("Expected handler for POST /test/slow");
		const res = await handler(
			{
				method: "POST",
				path: "/test/slow",
				body: { id: "x" },
				headers: {},
			},
			ctx,
		);
		expect(res.status).toBe(504);
		expect(res.body).toBeDefined();
		expect((res.body as { phase: string }).phase).toBe("timeout");
		if ((res.body as { phase: string }).phase === "timeout") {
			expect((res.body as { timeoutMs: number }).timeoutMs).toBe(50);
		}
	});

	test("request with signal that aborts returns 499 and error body with phase aborted", async () => {
		const controller = new AbortController();
		const registry = createRegistryWithMinimalOp();
		const handlers = buildHttpHandlers(registry, ctx);
		const handler = handlers.get("POST /test/echo");
		if (!handler) throw new Error("Expected handler for POST /test/echo");
		const resPromise = handler(
			{
				method: "POST",
				path: "/test/echo",
				body: { id: "x" },
				headers: {},
				signal: controller.signal,
			},
			ctx,
		);
		controller.abort();
		const res = await resPromise;
		expect(res.status).toBe(499);
		expect(res.body).toBeDefined();
		expect((res.body as { phase: string }).phase).toBe("aborted");
	});

	test("with idempotency store, same idempotency key returns cached response", async () => {
		let runs = 0;
		const op = {
			...createMinimalOp(),
			handler: async (payload: { id: string }) => {
				runs++;
				return { ok: true as const, value: payload };
			},
		};
		const registry = new Map<string, AnyOperation<DefaultContext>>();
		registry.set(op.name, op as AnyOperation<DefaultContext>);
		const store = createInMemoryIdempotencyStore();
		const handlers = buildHttpHandlers(registry, ctx, {
			idempotencyStore: store,
			idempotencyTtlMs: 60_000,
		});
		const handler = handlers.get("POST /test/echo");
		if (!handler) throw new Error("Expected handler for POST /test/echo");

		const req1 = {
			method: "POST" as const,
			path: "/test/echo",
			body: { id: "first" },
			headers: { "idempotency-key": "client-key-1" },
		};
		const res1 = await handler(req1, ctx);
		expect(res1.status).toBe(200);
		expect(res1.body).toEqual({ id: "first" });

		const req2 = {
			method: "POST" as const,
			path: "/test/echo",
			body: { id: "second" },
			headers: { "idempotency-key": "client-key-1" },
		};
		const res2 = await handler(req2, ctx);
		expect(res2.status).toBe(200);
		expect(res2.body).toEqual({ id: "first" });
		expect(runs).toBe(1);
	});
});

describe("buildHttpMapFromRegistry", () => {
	test("returns method and path for each http-exposed operation", () => {
		const registry = createRegistryWithMinimalOp();
		const map = buildHttpMapFromRegistry(registry);
		expect(map["test.echo"]).toEqual({ method: "POST", path: "/test/echo" });
	});
});
