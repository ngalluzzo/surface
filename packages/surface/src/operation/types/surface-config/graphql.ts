import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface GraphQLSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	/** "mutation" (default) or "query". */
	type?: "mutation" | "query";
	/** GraphQL field name; defaults to operation name. */
	field?: string;
}
