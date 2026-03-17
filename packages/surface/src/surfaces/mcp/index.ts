import { z } from "zod";
import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import { normalizeSurfaceBindings } from "../../operation";
import type {
	DefaultContext,
	ExecutionError,
	OperationRegistry,
} from "../../operation/types";
import {
	assertNoBindingValidationIssues,
	createDuplicateTargetBindingValidationSpec,
	registerBindingValidationSpecs,
	validateBindingSpecs,
} from "../../registry/binding-validation-core";
import type { McpServerLike, McpToolDefinition } from "./types";

export type { McpServerLike, McpToolDefinition } from "./types";

export const mcpBindingValidationSpecs = [
	createDuplicateTargetBindingValidationSpec({
		surface: "mcp",
		targetKind: "tool",
		filter: (binding) => binding.op.outputChunkSchema == null,
		select: (binding) => binding.config.tool,
	}),
] as const;

registerBindingValidationSpecs(mcpBindingValidationSpecs);

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
	const mcpBindings = normalizeSurfaceBindings(registry, "mcp").filter(
		(binding) => binding.op.outputChunkSchema == null,
	);
	assertNoBindingValidationIssues(
		validateBindingSpecs(mcpBindings, [...mcpBindingValidationSpecs]),
	);
	const hooks = "hooks" in registry ? getHooks(registry) : undefined;

	for (const binding of mcpBindings) {
		const { op, config } = binding;
		const inputSchema = z.toJSONSchema(op.schema) as Record<string, unknown>;

		const definition: McpToolDefinition = {
			name: config.tool,
			...(op.description !== undefined && { description: op.description }),
			inputSchema,
			handler: async (args: unknown) => {
				const result = await execute(op, args, ctx, "mcp", config, {
					...(hooks ? { hooks } : {}),
					binding,
				});

				if (result.ok === false) {
					return { text: formatExecutionError(result.error) };
				}
				return { text: JSON.stringify(result.value) };
			},
		};

		server.registerTool(definition);
	}
}
