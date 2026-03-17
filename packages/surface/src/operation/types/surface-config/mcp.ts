import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface McpSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	/** MCP tool name (the identifier the model uses). */
	tool: string;
}
