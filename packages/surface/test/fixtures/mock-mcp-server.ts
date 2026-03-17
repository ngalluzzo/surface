import type { McpServerLike, McpToolDefinition } from "../../src/index.js";

/**
 * Mock McpServerLike that records registerTool() calls and can invoke a tool's handler.
 * Use in adapters-mcp tests.
 */
export function createMockMcpServer(): {
	server: McpServerLike;
	registered: McpToolDefinition[];
	callTool: (name: string, args: unknown) => Promise<unknown>;
} {
	const registered: McpToolDefinition[] = [];
	const server: McpServerLike = {
		registerTool(def) {
			registered.push(def);
		},
	};
	async function callTool(name: string, args: unknown): Promise<unknown> {
		const tool = registered.find((t) => t.name === name);
		if (!tool) throw new Error(`No MCP tool found: ${name}`);
		return tool.handler(args);
	}
	return { server, registered, callTool };
}
