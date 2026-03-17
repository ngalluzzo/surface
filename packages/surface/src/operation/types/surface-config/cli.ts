import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface CliSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	command: string;
	description: string;
	output?: "json" | "table" | "plain";
}
