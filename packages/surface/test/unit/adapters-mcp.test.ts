import { describe, expect, test } from "bun:test";
import {
	buildMcpServer,
	type DefaultContext,
	type OperationRegistry,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createMockMcpServer } from "../fixtures/mock-mcp-server.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";

describe("buildMcpServer", () => {
	test("registers one tool per MCP-exposed operation with correct name, description, inputSchema", () => {
		const registry = createRegistryWithMinimalOp();
		const { server, registered } = createMockMcpServer();
		const ctx = createMockContext();

		buildMcpServer(registry, server, ctx);

		expect(registered).toHaveLength(1);
		const tool = registered[0];
		expect(tool).toBeDefined();
		expect(tool?.name).toBe("test_echo");
		expect(tool?.description).toBeUndefined();
		expect(tool?.inputSchema).toBeDefined();
		expect(typeof tool?.inputSchema).toBe("object");
		expect(typeof tool?.handler).toBe("function");
	});

	test("invoking tool handler with valid args runs execute and returns success result", async () => {
		const registry = createRegistryWithMinimalOp();
		const { server, callTool } = createMockMcpServer();
		const ctx = createMockContext();
		buildMcpServer(registry, server, ctx);

		const result = await callTool("test_echo", { id: "payload-1" });

		expect(result).toEqual({ text: JSON.stringify({ id: "payload-1" }) });
	});

	test("invalid args (validation failure) returns error result without throwing", async () => {
		const registry = createRegistryWithMinimalOp();
		const { server, callTool } = createMockMcpServer();
		const ctx = createMockContext();
		buildMcpServer(registry, server, ctx);

		const result = await callTool("test_echo", { wrong: "shape" });

		expect(result).toEqual({
			text: expect.stringContaining("Validation failed"),
		});
	});

	test("handler failure returns error result without throwing", async () => {
		const { defineOperation } = await import("../../src/index.js");
		const { z } = await import("zod");
		const op = defineOperation({
			name: "test.mcpHandlerFail",
			schema: z.object({ id: z.string() }),
			outputSchema: z.null(),
			handler: async () => ({ ok: false, error: "handler_error" }),
			expose: {
				mcp: { tool: "mcp_handler_fail" },
			},
		});
		const registry = new Map([
			["test.mcpHandlerFail", op],
		]) as OperationRegistry<DefaultContext>;
		const { server, callTool } = createMockMcpServer();
		const ctx = createMockContext();
		buildMcpServer(registry, server, ctx);

		const result = await callTool("mcp_handler_fail", { id: "x" });

		expect(result).toEqual({
			text: expect.stringContaining("Handler failed"),
		});
	});
});
