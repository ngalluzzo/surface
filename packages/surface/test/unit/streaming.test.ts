import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { AnyOperation, DefaultContext } from "../../src/index.js";
import {
	buildHttpHandlers,
	buildWsHandlers,
	defineOperation,
	defineRegistry,
	execute,
	registerJobOperations,
	resolveOperationSurfaceBinding,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";

const ctx = createMockContext();
const executeOnHttp = <C extends DefaultContext = DefaultContext>(
	op: AnyOperation<C>,
	raw: unknown,
	options?: Parameters<typeof execute>[5],
) =>
	execute(
		op,
		raw,
		ctx as C,
		"http",
		resolveOperationSurfaceBinding(op, "http")?.config,
		options,
	);

const chunkSchema = z.object({ index: z.number(), value: z.string() });
type Chunk = z.infer<typeof chunkSchema>;

/** Returns a value that is not an AsyncIterable; used to test handler validation. */
function invalidStreamValueForTest(): AsyncIterable<Chunk> {
	// Intentionally wrong type to trigger handler stream validation
	return "not an iterable" as unknown as AsyncIterable<Chunk>;
}

async function* streamChunks(count: number): AsyncIterable<Chunk> {
	for (let i = 0; i < count; i++) {
		yield { index: i, value: `chunk-${i}` };
	}
}

describe("streaming operations", () => {
	describe("handler stage", () => {
		test("when outputChunkSchema is set and handler returns AsyncIterable, execute returns ok with iterable", async () => {
			const op = defineOperation({
				name: "test.stream",
				schema: z.object({ id: z.string() }),
				outputSchema: z.never(),
				outputChunkSchema: chunkSchema,
				handler: async (payload) => {
					const n = Number.parseInt(payload.id, 10) || 2;
					return { ok: true, value: streamChunks(n) };
				},
				expose: { http: { default: { method: "POST", path: "/stream" } } },
			});

			const result = await executeOnHttp(op, { id: "3" });
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(
				typeof (result.value as AsyncIterable<Chunk>)[Symbol.asyncIterator],
			).toBe("function");
			const chunks: Chunk[] = [];
			for await (const c of result.value as AsyncIterable<Chunk>) {
				chunks.push(c);
			}
			expect(chunks).toHaveLength(3);
			expect(chunks[0]).toEqual({ index: 0, value: "chunk-0" });
		});

		test("when outputChunkSchema is set but handler returns non-AsyncIterable, execute returns handler error", async () => {
			const op = defineOperation({
				name: "test.badStream",
				schema: z.object({ id: z.string() }),
				outputSchema: z.never(),
				outputChunkSchema: chunkSchema,
				handler: async () => ({
					ok: true,
					value: invalidStreamValueForTest(),
				}),
				expose: { http: { default: { method: "POST", path: "/bad" } } },
			});

			const result = await executeOnHttp(op, { id: "x" });
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("handler");
			if (result.error.phase === "handler" && "error" in result.error) {
				expect(result.error.error).toContain("AsyncIterable");
			}
		});
	});

	describe("HTTP surface", () => {
		test("stream op returns body as ReadableStream (NDJSON)", async () => {
			const op = defineOperation({
				name: "test.streamHttp",
				schema: z.object({ id: z.string() }),
				outputSchema: z.never(),
				outputChunkSchema: chunkSchema,
				handler: async (p) => ({
					ok: true,
					value: streamChunks(Number.parseInt(p.id, 10) || 2),
				}),
				expose: {
					http: { default: { method: "POST", path: "/stream-http" } },
				},
			});

			const registry = defineRegistry("test", [op]);
			const handlers = buildHttpHandlers(registry, ctx);
			const handler = handlers.get("POST /stream-http");
			if (!handler) throw new Error("Expected handler");
			const res = await handler(
				{
					method: "POST",
					path: "/stream-http",
					body: { id: "2" },
					headers: {},
				},
				ctx,
			);
			expect(res.status).toBe(200);
			expect(res.body).toBeInstanceOf(ReadableStream);
			const reader = (res.body as ReadableStream<Uint8Array>).getReader();
			const decoder = new TextDecoder();
			let text = "";
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				text += decoder.decode(value);
			}
			const lines = text.trim().split("\n");
			expect(lines).toHaveLength(2);
			const line0 = lines[0];
			const line1 = lines[1];
			expect(line0).toBeDefined();
			expect(line1).toBeDefined();
			expect(JSON.parse(line0 as string)).toEqual({
				index: 0,
				value: "chunk-0",
			});
			expect(JSON.parse(line1 as string)).toEqual({
				index: 1,
				value: "chunk-1",
			});
		});
	});

	describe("WS surface", () => {
		test("stream op sends multiple messages (chunk, done)", async () => {
			const op = defineOperation({
				name: "test.streamWs",
				schema: z.object({ id: z.string() }),
				outputSchema: z.never(),
				outputChunkSchema: chunkSchema,
				handler: async (p) => ({
					ok: true,
					value: streamChunks(Number.parseInt(p.id, 10) || 2),
				}),
				expose: { ws: { default: {} } },
			});

			const registry = defineRegistry("test", [op]);
			const sent: unknown[] = [];
			const connection = {
				send: (data: unknown) => {
					sent.push(data);
				},
			};
			const handlers = buildWsHandlers(registry, () => ctx);
			await handlers.onMessage(connection, {
				op: "test.streamWs",
				payload: { id: "2" },
				id: 1,
			});

			expect(sent).toHaveLength(3);
			expect(sent[0]).toEqual({
				id: 1,
				ok: true,
				stream: true,
				chunk: { index: 0, value: "chunk-0" },
			});
			expect(sent[1]).toEqual({
				id: 1,
				ok: true,
				stream: true,
				chunk: { index: 1, value: "chunk-1" },
			});
			expect(sent[2]).toEqual({ id: 1, ok: true, stream: true, done: true });
		});
	});

	describe("non-stream surfaces skip stream ops", () => {
		test("job surface skips stream op", () => {
			const op = defineOperation({
				name: "test.streamJob",
				schema: z.object({ id: z.string() }),
				outputSchema: z.never(),
				outputChunkSchema: chunkSchema,
				handler: async () => ({ ok: true, value: streamChunks(0) }),
				expose: { job: { default: { queue: "q", retries: 1 } } },
			});

			const registry = defineRegistry("test", [op]);
			const registered: unknown[] = [];
			const runner = { register: (def: unknown) => registered.push(def) };
			registerJobOperations(registry, runner, ctx);
			expect(registered).toHaveLength(0);
		});
	});
});
