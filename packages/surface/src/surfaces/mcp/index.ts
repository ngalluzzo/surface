import { z } from "zod";
import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
import type {
	DefaultContext,
	ExecutionError,
	OperationRegistry,
} from "../../operation/types";
import type { McpServerLike, McpToolDefinition } from "./types";

export type { McpServerLike, McpToolDefinition } from "./types";

function formatExecutionError(error: ExecutionError): string {
	switch (error.phase) {
		case "surface-guard":
		case "domain-guard":
			return `Error [${error.code}]${error.message ? `: ${error.message}` : ""}`;
		case "validation":
			return `Validation failed: ${JSON.stringify(error.issues)}`;
		case "handler":
			if ("error" in error) return `Handler failed: ${error.error}`;
			return `Output validation failed: ${JSON.stringify(error.issues)}`;
		case "timeout":
			return `Timeout after ${error.timeoutMs}ms`;
		case "aborted":
			return "Aborted";
		default:
			return `Error: ${JSON.stringify(error)}`;
	}
}

/**
 * Registers MCP-exposed operations as tools on the given server.
 * Tool name, description, and inputSchema are derived from the operation;
 * the handler runs execute() and returns result or error as tool result (no throw).
 * Consumers create a server (e.g. from @modelcontextprotocol/sdk) that implements
 * McpServerLike and pass it here.
 */
export function buildMcpServer<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	server: McpServerLike,
	ctx: C,
): void {
	const mcpOps = forSurface(registry, "mcp");
	const hooks = getHooks(mcpOps);

	for (const [, op] of mcpOps) {
		if (op.outputChunkSchema != null) continue;
		const config = op.expose.mcp;
		if (!config) throw new Error(`Missing mcp config for ${op.name}`);
		const inputSchema = z.toJSONSchema(op.schema) as Record<string, unknown>;

		const definition: McpToolDefinition = {
			name: config.tool,
			...(op.description !== undefined && { description: op.description }),
			inputSchema,
			handler: async (args: unknown) => {
				const result = await execute(
					op,
					args,
					ctx,
					"mcp",
					config,
					hooks ? { hooks } : undefined,
				);

				if (!result.ok) {
					return { text: formatExecutionError(result.error) };
				}
				return { text: JSON.stringify(result.value) };
			},
		};

		server.registerTool(definition);
	}
}
