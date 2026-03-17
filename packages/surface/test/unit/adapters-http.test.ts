import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
	BindingValidationError,
	buildHttpBindingsFromRegistry,
	buildHttpHandlers,
	buildHttpMapFromRegistry,
	composeRegistries,
	createInMemoryIdempotencyStore,
	defineOperation,
	defineRegistry,
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
					default: {
						method: "POST" as const,
						path: "/test/slow",
						timeout: 50,
					},
				},
			},
			handler: async (payload: { id: string }) => {
				await new Promise((r) => setTimeout(r, 200));
				return { ok: true as const, value: payload };
			},
		};
		const registry = defineRegistry("test", [slowOp]);
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
		const registry = defineRegistry("test", [op]);
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

	test("same operation can expose multiple http bindings", async () => {
		const op = {
			...createMinimalOp(),
			expose: {
				http: {
					default: { method: "POST" as const, path: "/test/echo" },
					admin: { method: "POST" as const, path: "/test/echo/admin" },
				},
			},
		};
		const registry = defineRegistry("test", [op]);

		const handlers = buildHttpHandlers(registry, ctx);
		expect(handlers.has("POST /test/echo")).toBe(true);
		expect(handlers.has("POST /test/echo/admin")).toBe(true);

		const defaultHandler = handlers.get("POST /test/echo");
		const adminHandler = handlers.get("POST /test/echo/admin");
		if (!defaultHandler || !adminHandler) {
			throw new Error("Expected both http handlers");
		}

		const defaultResponse = await defaultHandler(
			{
				method: "POST",
				path: "/test/echo",
				body: { id: "default-route" },
				headers: {},
			},
			ctx,
		);
		const adminResponse = await adminHandler(
			{
				method: "POST",
				path: "/test/echo/admin",
				body: { id: "admin-route" },
				headers: {},
			},
			ctx,
		);

		expect(defaultResponse).toEqual({
			status: 200,
			body: { id: "default-route" },
		});
		expect(adminResponse).toEqual({
			status: 200,
			body: { id: "admin-route" },
		});
	});

	test("bind can compose body, path, query, and headers into one payload", async () => {
		const op = defineOperation({
			name: "test.boundHttp",
			schema: z.object({
				note: z.string(),
				incidentId: z.string(),
				page: z.string(),
				meta: z.object({
					requestId: z.string(),
				}),
			}),
			outputSchema: z.object({
				note: z.string(),
				incidentId: z.string(),
				page: z.string(),
				meta: z.object({
					requestId: z.string(),
				}),
			}),
			handler: async (payload) => ({ ok: true as const, value: payload }),
			expose: {
				http: {
					default: {
						method: "POST" as const,
						path: "/incidents/:id",
						bind: {
							path: { id: "incidentId" },
							query: { page: "page" },
							headers: { "x-request-id": "meta.requestId" },
						},
					},
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const handlers = buildHttpHandlers(registry, ctx);
		const handler = handlers.get("POST /incidents/:id");
		if (!handler) throw new Error("Expected handler for POST /incidents/:id");

		const res = await handler(
			{
				method: "POST",
				path: "/incidents/inc-1",
				body: { note: "hello" },
				params: { id: "inc-1" },
				query: { page: "2" },
				headers: { "x-request-id": "req-123" },
			},
			ctx,
		);

		expect(res).toEqual({
			status: 200,
			body: {
				note: "hello",
				incidentId: "inc-1",
				page: "2",
				meta: {
					requestId: "req-123",
				},
			},
		});
	});

	test("throws on duplicate http routes", () => {
		const opA = {
			...createMinimalOp(),
			name: "test.echoA",
			expose: {
				http: {
					default: { method: "POST" as const, path: "/test/collision" },
				},
			},
		};
		const opB = {
			...createMinimalOp(),
			name: "test.echoB",
			expose: {
				http: {
					default: { method: "POST" as const, path: "/test/collision" },
				},
			},
		};
		const registry = defineRegistry("test", [opA, opB]);

		try {
			buildHttpHandlers(registry, ctx);
			throw new Error("Expected duplicate route validation error");
		} catch (error) {
			expect(error).toBeInstanceOf(BindingValidationError);
			if (!(error instanceof BindingValidationError)) return;
			expect(error.issues).toHaveLength(1);
			expect(error.issues[0]).toMatchObject({
				surface: "http",
				targetKind: "route",
				target: "POST /test/collision",
			});
		}
		expect(() => buildHttpBindingsFromRegistry(registry)).toThrow(
			BindingValidationError,
		);
	});
});

describe("buildHttpMapFromRegistry", () => {
	test("returns method and path for each http-exposed operation", () => {
		const registry = createRegistryWithMinimalOp();
		const map = buildHttpMapFromRegistry(registry) as Record<
			string,
			{ method: string; path: string }
		>;
		expect(map["test.echo"]).toEqual({ method: "POST", path: "/test/echo" });
	});

	test("uses binding-aware keys for additional bindings", () => {
		const op = {
			...createMinimalOp(),
			expose: {
				http: {
					default: { method: "POST" as const, path: "/test/echo" },
					admin: { method: "POST" as const, path: "/test/echo/admin" },
				},
			},
		};
		const registry = defineRegistry("test", [op]);

		const map = buildHttpMapFromRegistry(registry) as Record<
			string,
			{ method: string; path: string }
		>;
		expect(map["test.echo"]).toEqual({ method: "POST", path: "/test/echo" });
		expect(map["test.echo:admin"]).toEqual({
			method: "POST",
			path: "/test/echo/admin",
		});
	});
});

describe("buildHttpBindingsFromRegistry", () => {
	test("returns structured binding definitions", () => {
		const registry = createRegistryWithMinimalOp();
		const bindings = buildHttpBindingsFromRegistry(registry) as Record<
			string,
			unknown
		>;

		expect(bindings["test.echo"]).toEqual({
			key: "test.echo",
			ref: { surface: "http", operation: "test.echo", binding: "default" },
			method: "POST",
			path: "/test/echo",
		});
	});

	test("skips stream operations from the standard HTTP binding builder", () => {
		const op = defineOperation({
			name: "test.streamHttp",
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
			expose: {
				http: {
					default: { method: "GET" as const, path: "/test/stream-http" },
				},
			},
		});
		const registry = defineRegistry("test", [op]);
		const bindings = buildHttpBindingsFromRegistry(registry) as Record<
			string,
			unknown
		>;

		expect(bindings).toEqual({});
		expect(buildHttpMapFromRegistry(registry)).toEqual({});
	});
});
