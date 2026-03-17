import type { DefaultContext } from "../default-context";
import type { BaseSurfaceConfig } from "./base";

export interface WsSurfaceConfig<TPayload, C extends DefaultContext>
	extends BaseSurfaceConfig<TPayload, C> {
	/** Optional: key in the incoming message that holds the operation name; defaults to "op". */
	messageKey?: string;
}
