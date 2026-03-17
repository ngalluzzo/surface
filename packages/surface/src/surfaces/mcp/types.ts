/**
 * Definition for a single MCP tool. The adapter builds one per MCP-exposed operation.
 * Handler receives tool arguments; adapter runs execute() and maps result to tool result (no throw).
 */
export interface McpToolDefinition {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
	handler: (args: unknown) => Promise<unknown>;
}

/**
 * MCP server contract. Consumers create a server (e.g. from @modelcontextprotocol/sdk)
 * that implements this and pass it to buildMcpServer().
 */
export interface McpServerLike {
	registerTool(definition: McpToolDefinition): void;
}
